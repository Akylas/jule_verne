import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
import { GPS, GenericGeoLocation, Options as GeolocationOptions, LocationMonitor, setGeoLocationKeys, setMockEnabled } from '@nativescript-community/gps';
import * as perms from '@nativescript-community/perms';
import { TNSTextToSpeech } from '@nativescript-community/texttospeech';
import { AndroidActivityResultEventData, AndroidApplication, ApplicationEventData, android as androidApp, off as applicationOff, on as applicationOn } from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { File, path } from '@nativescript/core/file-system';
import { CoreTypes } from '@nativescript/core/ui/enums/enums';
import { isNumber } from '@nativescript/core/utils/types';
import { Feature, LineString, Point, Polygon } from 'geojson';
import { bind } from 'helpful-decorators';
import { bearing } from '~/helpers/geo';
// import { parseGPX } from '~/helpers/gpx';
import { $t, $tc } from '~/helpers/locale';
import { confirm } from '~/utils/dialogs';
import { computeDistanceBetween, distanceToEnd, isLocactionInBbox, isLocationOnPath } from '~/utils/geo';
import { getGlassesImagesFolder } from '~/utils/utils';
import Track, { GeometryProperties, TrackFeature, TrackGeometry } from '../models/Track';
import { BluetoothHandler } from './BluetoothHandler';
import { DBHandler } from './DBHandler';
const determineAngleDeviationFromNorth = require('angle-deviation-from-north');
const insidePolygon = require('point-in-polygon');
const geojsonArea = require('@mapbox/geojson-area');

setGeoLocationKeys('lat', 'lon', 'altitude');
const TTS = new TNSTextToSpeech();
TTS.init();

export type GeoLocation = GenericGeoLocation<LatLonKeys> & {
    computedBearing?: number;
};

let geolocation: GPS;

//@ts-ignore
export const desiredAccuracy = __ANDROID__ ? CoreTypes.Accuracy.high : kCLLocationAccuracyBestForNavigation;
export const timeout = 20000;
export const minimumUpdateTime = 1000; // Should update every 1 second according ;

setMockEnabled(true);

export { Track as Session };

export enum SessionState {
    STOPPED = 'stopped',
    RUNNING = 'running',
    PAUSED = 'paused'
}

export function getDistance(loc1, loc2) {
    return Math.round(geolocation.distance(loc1, loc2) * 1000) / 1000;
}

export const SessionStateEvent = 'sessionState';
export const GPSStatusChangedEvent = 'status';
export const UserLocationEvent = 'userLocation';
export const UserRawLocationEvent = 'userRawLocation';
export const TrackSelecteEvent = 'trackSelected';
export const PositionStateEvent = 'positionState';
export const InsideFeatureEvent = 'insideFeature';
export const FeatureViewedEvent = 'storyPlayed';
export const OuterRingEvent = 'outer_ring';
export const AimingFeatureEvent = 'aimingFeature';

const TAG = '[Geo]';

interface GPSEvent extends EventData {
    data?: any;
}

export interface SessionEventData extends GPSEvent {}

export interface UserLocationdEventData extends GPSEvent {
    location?: GeoLocation;
    error?: Error;
    aimingFeature?: Feature<TrackGeometry, GeometryProperties>;
    aimingAngle?: number;
    isInTrackBounds?: boolean;
}

export interface SessionChronoEventData extends GPSEvent {
    data: number; // chrono
}

export class GeoHandler extends Observable {
    watchId;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;

    sessionState: SessionState = SessionState.STOPPED;
    dbHandler: DBHandler;
    lastLocation?: GeoLocation;

    isSpeaking = false;
    speakQueue: string[] = [];

    bluetoothHandler: BluetoothHandler;

    launched = false;
    positionState: { [k: string]: any } = {};
    _currentTrack: Track;
    _isInTrackBounds = false;
    _aimingFeature: Feature<TrackGeometry, GeometryProperties> = null;
    _playedHistory: number[] = [];
    _featuresViewed: string[] = [];
    aimingAngle = 0;
    gpsEnabled = true;
    _insideFeature: TrackFeature = null;
    isSessionPaused() {
        return this.sessionState === SessionState.PAUSED;
    }

    get featuresViewed() {
        return this._featuresViewed;
    }
    set featuresViewed(value) {
        this._featuresViewed = value;
        this.notify({
            eventName: FeatureViewedEvent,
            data: {
                featureViewed: this._featuresViewed
            }
        });
    }
    mReadableStories: number[] = null;
    setReadableStories(arg0: number[]) {
        console.log('setReadableStories', arg0);
        this.mReadableStories = arg0;
    }

    setSessionState(state: SessionState) {
        if (this.sessionState === state) {
            return;
        }
        DEV_LOG && console.log('setSessionState', state);
        this.sessionState = state;
        this.notify({
            eventName: SessionStateEvent,
            object: this,
            data: {
                state
            }
        } as SessionEventData);
    }
    actualSessionStart(createSession = false) {
        console.log('actualSessionStart', this.sessionState);
        this.setSessionState(SessionState.RUNNING);
        this.startWatch();
    }
    actualSessionStop(finish = false) {
        this.setSessionState(finish ? SessionState.STOPPED : SessionState.PAUSED);
        this.stopWatch();
    }

    constructor() {
        super();

        this.dbHandler = new DBHandler();
        if (DEV_LOG) {
            console.log(TAG, 'creating GPS Handler', !!geolocation, DEV_LOG);
        }
        if (!geolocation) {
            geolocation = new GPS();
        }
    }

    async stop() {
        DEV_LOG && console.log(TAG, 'stop');
        await this.stopSession(true);
        this.launched = false;
        geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOff(backgroundEvent, this.onAppPause, this);
        applicationOff(foregroundEvent, this.onAppResume, this);
        await this.dbHandler.stop();
        DEV_LOG && console.log(TAG, 'stop done');
    }
    set isInTrackBounds(value: boolean) {
        if (this._isInTrackBounds !== value) {
            // console.log('isInTrackBounds', value);
            this._isInTrackBounds = value;
            if (!value) {
                this.bluetoothHandler.playNavigationInstruction('exit');
            } else {
                // stop instruction
                this.bluetoothHandler.stopNavigationInstruction();
            }
            this.notify({
                eventName: OuterRingEvent,
                object: this,
                data: {
                    isInBounds: this._isInTrackBounds
                }
            });
        } else if (!this._isInTrackBounds) {
        }
    }
    get isInTrackBounds() {
        return this._isInTrackBounds;
    }
    set currentTrack(track: Track) {
        this._currentTrack = track;
        this._isInTrackBounds = true;
        if (track) {
            DEV_LOG && console.log('saving track id', track.id, typeof track.id);
            appSettings.setString('selectedTrackId', track.id);
        } else {
            DEV_LOG && console.log('removing saved track id');
            appSettings.remove('selectedTrackId');
        }

        this.notify({ eventName: TrackSelecteEvent, track, object: this });
    }
    get currentTrack() {
        return this._currentTrack;
    }

    set aimingFeature(feature: Feature<TrackGeometry, GeometryProperties>) {
        if (feature !== this._aimingFeature) {
            this._aimingFeature = feature;
            this.notify({
                eventName: AimingFeatureEvent,
                object: this,
                data: {
                    feature
                }
            });
        }
    }
    get aimingFeature() {
        return this._aimingFeature;
    }
    async start() {
        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);

        const gpsEnabled = await this.checkLocationPerm();
        // set to true if not allowed yet for the UI
        this.gpsEnabled = !gpsEnabled || geolocation.isEnabled();
        applicationOn(backgroundEvent, this.onAppPause, this);
        applicationOn(foregroundEvent, this.onAppResume, this);
        try {
            await this.dbHandler.start();
            const selectedTrackId = appSettings.getString('selectedTrackId');
            if (selectedTrackId) {
                const track = await this.dbHandler.getItem(selectedTrackId);
                console.log('track', !!track);
                if (track) {
                    this.currentTrack = track;
                }
            }
        } catch (err) {
            console.log('dbHandler', 'start error', err, err.stack);
            return Promise.reject(err);
        }
    }

    onAppResume(args: ApplicationEventData) {
        if (args.ios) {
            this._isIOSBackgroundMode = false;
            // For iOS applications, args.ios is UIApplication.
            // if (DEV_LOG) {
            //     console.log(TAG,'UIApplication: resumeEvent', this.isWatching());
            // }
            // if (this.isWatching()) {
            //     const watcher = this.currentWatcher;
            //     this.stopWatch();
            //     this.startWatch(watcher);
            // }
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (args.ios) {
            this._isIOSBackgroundMode = true;
            // For iOS applications, args.ios is UIApplication.
            // if (DEV_LOG) {
            //     console.log(TAG,'UIApplication: suspendEvent', this.isWatching());
            // }
            // if (this.isWatching()) {
            //     const watcher = this.currentWatcher;
            //     this.stopWatch();
            //     this.startWatch(watcher);
            // }
        }
    }

    onGPSStateChange(e: GPSEvent) {
        const enabled = (this.gpsEnabled = e.data.enabled);
        if (DEV_LOG) {
            console.log(TAG, 'GPS state change', enabled);
        }
        if (!enabled) {
            this.stopSession();
        }
        this.notify({
            eventName: GPSStatusChangedEvent,
            object: this,
            data: enabled
        });
    }

    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve(true);
        } else {
            return confirm({
                message: $tc('gps_not_enabled'),
                okButtonText: $t('settings'),
                cancelButtonText: $t('cancel')
            }).then((result) => {
                if (!!result) {
                    return geolocation.openGPSSettings();
                }
                return Promise.reject();
            });
        }
    }
    permResultCheck(r) {
        if (Array.isArray(r)) {
            return r[0] === 'authorized';
        } else {
            const unauthorized = Object.keys(r).some((s) => r[s] !== 'authorized');
            return !unauthorized;
        }
    }
    async checkLocationPerm() {
        const r = await perms.check('location');
        return this.permResultCheck(r);
    }
    async authorizeLocation() {
        const r = await perms.request('location');
        if (!this.permResultCheck(r)) {
            throw new Error('gps_denied');
        }
        this.gpsEnabled = geolocation.isEnabled();
        return r;
    }
    checkEnabledAndAuthorized(always = true) {
        return Promise.resolve()
            .then(async () => {
                const r = await this.checkLocationPerm();
                if (!r) {
                    return this.authorizeLocation();
                }
            })
            .then(() => this.askToEnableIfNotEnabled())
            .catch((err) => {
                if (err && /denied/i.test(err.message)) {
                    confirm({
                        message: $tc('gps_not_authorized'),
                        okButtonText: $t('settings'),
                        cancelButtonText: $t('cancel')
                    }).then((result) => {
                        if (result) {
                            geolocation.openGPSSettings().catch(() => {});
                        }
                    });
                    return Promise.reject();
                } else {
                    return Promise.reject(err);
                }
            });
    }

    enableLocation() {
        return this.checkEnabledAndAuthorized();
    }

    isBatteryOptimized(context: android.content.Context) {
        const pwrm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager;
        const name = context.getPackageName();
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            return !pwrm.isIgnoringBatteryOptimizations(name);
        }
        return false;
    }
    checkBattery() {
        if (__IOS__) {
            return Promise.resolve();
        }
        const activity = androidApp.foregroundActivity || androidApp.startActivity;
        if (this.isBatteryOptimized(activity) && android.os.Build.VERSION.SDK_INT >= 22) {
            // return confirm({
            //     message: $tc('battery_not_optimized'),
            //     okButtonText: $t('disable'),
            //     cancelButtonText: $t('cancel')
            // }).then(result => {
            //     if (!!result) {
            return new Promise<void>((resolve, reject) => {
                const REQUEST_CODE = 6645;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve();
                        // wait a bit for the setting to actually be updated
                        // setTimeout(() => {
                        //     if (!this.isBatteryOptimized(activity)) {
                        //         showSnack({ message: $tc('battery_not_optimized') });
                        //     }
                        // }, 1000);
                    }
                };
                androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse('package:' + activity.getPackageName()));
                activity.startActivityForResult(intent, REQUEST_CODE);
            });
            //     }
            // });

            // const name = resources.getString(R.string.app_name)
            // Toast.makeText(applicationContext, "Battery optimization -> All apps -> $name -> Don't optimize", Toast.LENGTH_LONG).show()
        }
        return Promise.resolve();
    }
    getLastKnownLocation(): GeoLocation {
        return LocationMonitor.getLastKnownLocation<LatLonKeys>();
    }
    getLocation(options?) {
        return geolocation
            .getCurrentLocation<LatLonKeys>(options || { desiredAccuracy, timeout, onDeferred: this.onDeferred, skipPermissionCheck: true })
            .then((r) => {
                if (DEV_LOG) {
                    console.log(TAG, 'getLocation', r);
                }
                if (r) {
                    this.notify({
                        eventName: UserRawLocationEvent,
                        object: this,
                        location: r
                    } as UserLocationdEventData);
                }

                return r;
            })
            .catch((err) => {
                this.notify({
                    eventName: UserRawLocationEvent,
                    object: this,
                    error: err
                } as UserLocationdEventData);
                return Promise.reject(err);
            });
    }

    @bind
    onDeferred() {
        this._deferringUpdates = false;
    }
    async speakText(text: string) {
        if (this.isSpeaking) {
            this.speakQueue.push(text);
            return;
        }
        this.isSpeaking = true;
        try {
            await TTS.speak({
                text,
                finishedCallback: () => {
                    this.isSpeaking = false;
                    if (this.speakQueue.length > 0) {
                        this.speakText(this.speakQueue.shift());
                    }
                }
            });
        } catch (err) {
            this.isSpeaking = false;
        }
    }

    set insideFeature(value) {
        if (value !== this._insideFeature) {
            this._insideFeature = value;
            DEV_LOG && console.log('insideFeature', value?.properties.name);

            const playing = this.bluetoothHandler.isPlayingStory || this.bluetoothHandler.isPlayingMusic;
            if (value && !playing) {
                let nextStoryIndex;
                if (this.mReadableStories) {
                    nextStoryIndex = Math.max(0, Math.min(...this.mReadableStories.filter((item) => this._playedHistory.indexOf(item) === -1)));
                } else {
                    nextStoryIndex = Math.max(0, ...this._playedHistory) + 1;
                    for (let index = nextStoryIndex; index > 0; index--) {
                        if (this._playedHistory.indexOf(index) === -1) {
                            nextStoryIndex = index;
                        }
                    }
                }
                DEV_LOG && console.log('nextStoryIndex', this._playedHistory, this.mReadableStories, nextStoryIndex);

                const name = ('index' in value.properties ? value.properties.index : value.properties.name) + '';

                const featuresViewed = this.featuresViewed;
                let needsToplayMusic = false;
                if (name.endsWith('_out')) {
                    needsToplayMusic = true;
                }
                const featureId = (name + '').split('_')[0];
                if (featuresViewed.indexOf(featureId) === -1) {
                    featuresViewed.push(featureId);
                    featuresViewed.push(featureId + '_out');
                }
                this.featuresViewed = featuresViewed;

                (async () => {
                    await this.bluetoothHandler.stopPlayingInstruction();
                    await this.bluetoothHandler.playInstruction('starting_story');
                    if (needsToplayMusic) {
                        // story will be queued after
                        this.bluetoothHandler.playMusic(nextStoryIndex);
                    }
                    this.bluetoothHandler.playRideauAndStory(nextStoryIndex);
                })();
            } else {
                // this.bluetoothHandler.stopPlayingLoop();
            }
            this.notify({
                eventName: InsideFeatureEvent,
                object: this,
                data: {
                    feature: value
                }
            });
        }
    }

    get insideFeature() {
        return this._insideFeature;
    }
    async handleFeatureEvent(events: { index: number; distance?: number; trackId: string; state: 'inside' | 'leaving' | 'entering'; feature: TrackFeature }[]) {
        const insideFeatures = events.filter((e) => e.state !== 'leaving');
        // if (DEV_LOG) {
        // console.log('handleFeatureEvent', events);
        // }
        if (insideFeatures.length > 1) {
            let minIndex = 0;
            let minArea = Number.MAX_SAFE_INTEGER;
            insideFeatures.forEach((f, index) => {
                const area = geojsonArea.geometry(f.feature.geometry);
                if (area < minArea) {
                    minIndex = index;
                    minArea = area;
                }
            });
            this.insideFeature = insideFeatures[minIndex].feature;
        } else if (insideFeatures.length === 1) {
            this.insideFeature = insideFeatures[0].feature;
        } else {
            this.insideFeature = null;
        }
        this.notify({
            eventName: PositionStateEvent,
            object: this,
            data: {
                events
            }
        });
    }

    // async handleLeavingFeature(trackId: string, feature: TrackFeature) {
    //     this.speakText($t('leaving_feature', feature.properties.name));
    //     this.insideFeature = null;
    //     this.notify({
    //         eventName: PositionStateEvent,
    //         object: this,
    //         data: {
    //             feature,
    //             trackId,
    //             state: 'leaving'
    //         }
    //     });
    // }
    // async handleEnteringFeature(trackId: string, feature: Feature<TrackGeometry, GeometryProperties>, extraData) {
    //     this.speakText($t('entering_feature', feature.properties.name));
    //     this.insideFeature = feature;
    //     this.bluetoothHandler.stopPlayingLoop();
    //     this.notify({
    //         eventName: PositionStateEvent,
    //         object: this,
    //         data: {
    //             ...extraData,
    //             trackId,
    //             feature,
    //             state: 'entering'
    //         }
    //     });
    // }
    // handleInsideFeature(trackId: string, feature: Feature<TrackGeometry, GeometryProperties>, extraData) {
    //     this.notify({
    //         eventName: PositionStateEvent,
    //         object: this,
    //         data: {
    //             ...extraData,
    //             trackId,
    //             feature,
    //             state: 'inside'
    //         }
    //     });
    // }

    playedStory(index: string) {
        const rindex = parseInt(index, 10);
        if (this._playedHistory.indexOf(rindex) === -1) {
            this._playedHistory.push(rindex);
        }
        console.log('playedStory', index, rindex, this._playedHistory, !!this.insideFeature);
        if (this.insideFeature) {
            // we clear insideFeature as this feature is now played and thus
            // we should ignore it and notify of next aiming feature
            this.insideFeature = null;
        }
    }
    mLastAimingDirection: string;
    mLastPlayedAimingDirection: string;
    mLastPlayedAimingDirectionTime: number;
    updateTrackWithLocation(loc: GeoLocation) {
        // if (DEV_LOG) {
        //     console.log('updateTrackWithLocation', JSON.stringify(loc));
        // }
        if (this.currentTrack) {
            const features = this.currentTrack.geometry.features;

            const outerRings = features.filter((f) => ('index' in f.properties ? f.properties.index : f.properties.name === 'outer_ring'));
            if (outerRings) {
                // console.log('outerRings', outerRings.length);
                const inBounds = outerRings.reduce((acc, current) => {
                    const g = current.geometry as Polygon;
                    return acc || insidePolygon([loc.lon, loc.lat], g.coordinates[0]);
                }, false);
                // this.isInTrackBounds = isLocactionInBbox(loc, outerRing.bbox, 0);
                this.isInTrackBounds = inBounds;
            }
            let minFeature: TrackFeature = null;
            let minDist = Number.MAX_SAFE_INTEGER;
            const closestStoryStep = 50;

            // the aiming algorithm will tend to get you to the next story
            // except if you are very close(closestStoryStep) to another story
            let nextPotentialIndex = Math.max(0, ...this._playedHistory) + 1;
            for (let index = nextPotentialIndex; index > 0; index--) {
                if (this._playedHistory.indexOf(index) === -1) {
                    nextPotentialIndex = index;
                }
            }
            const currentPosition = [loc.lon, loc.lat];
            const events = [];
            features.forEach((feature) => {
                const properties = feature.properties;
                const name = 'index' in properties ? properties.index : properties.name;
                if (name === 'outer_ring' || this._featuresViewed.indexOf((name + '').split('_')[0]) !== -1) {
                    return;
                }

                // used to compute aiming feature
                if (feature.properties.isStory === true || isNumber(name)) {
                    const dist = computeDistanceBetween(feature.geometry.center, currentPosition);
                    if (dist < minDist) {
                        minDist = dist;
                        minFeature = feature;
                    }
                }
                // add a bit of delta (m)
                const isInBounds = isLocactionInBbox(loc, feature.bbox, 0);

                // if (DEV_LOG) {
                //     console.log('updateTrackWithLocation in bounds!', name, feature.id);
                // }
                if (!isInBounds) {
                    if (this.positionState[feature.id]) {
                        delete this.positionState[feature.id];
                        events.push({
                            state: 'leaving',
                            trackId: this.currentTrack.id,
                            feature
                        });
                        // we are getting out
                        // this.handleLeavingFeature(this.currentTrack.id, feature);
                    }
                    return;
                }
                // we are in bounds!
                const geometry = feature.geometry;

                switch ((properties.shape || geometry.type).toLowerCase()) {
                    case 'line': {
                        const g = geometry as LineString;
                        const index = isLocationOnPath(loc, g.coordinates, false, true, 10);
                        if (index >= 0) {
                            const distance = distanceToEnd(index, g.coordinates);
                            const currentData = this.positionState[feature.id];
                            this.positionState[feature.id] = {
                                index,
                                distance
                            };
                            if (currentData) {
                                events.push({
                                    state: 'inside',
                                    trackId: this.currentTrack.id,
                                    feature,
                                    index,
                                    distance
                                });
                                // this.handleInsideFeature(this.currentTrack.id, feature, {
                                //     feature,
                                //     index,
                                //     distance
                                // });
                            } else {
                                events.push({
                                    state: 'entering',
                                    trackId: this.currentTrack.id,
                                    feature,
                                    index,
                                    distance
                                });
                                // this.handleEnteringFeature(this.currentTrack.id, feature, {
                                //     feature,
                                //     index,
                                //     distance
                                // });
                            }
                        } else {
                            const currentData = this.positionState[feature.id];
                            if (currentData) {
                                delete this.positionState[feature.id];
                                // this.handleLeavingFeature(this.currentTrack.id, feature);
                                events.push({
                                    state: 'leaving',
                                    trackId: this.currentTrack.id,
                                    feature,
                                    index
                                });
                            }
                        }
                        break;
                    }
                    case 'circle': {
                        const g = geometry as Point;
                        const distance = computeDistanceBetween([loc.lon, loc.lat], g.coordinates);
                        const currentData = this.positionState[feature.id];
                        if (distance <= properties.radius) {
                            this.positionState[feature.id] = {
                                distance
                            };
                            // we are in the circle
                            if (currentData) {
                                // this.handleInsideFeature(this.currentTrack.id, feature, {
                                //     feature,
                                //     distance
                                // });
                                events.push({
                                    state: 'inside',
                                    trackId: this.currentTrack.id,
                                    feature,
                                    distance
                                });
                            } else {
                                // this.handleEnteringFeature(this.currentTrack.id, feature, {
                                //     feature,
                                //     distance
                                // });
                                events.push({
                                    state: 'entering',
                                    trackId: this.currentTrack.id,
                                    feature,
                                    distance
                                });
                            }
                        } else if (currentData) {
                            delete this.positionState[feature.id];
                            // this.handleLeavingFeature(this.currentTrack.id, feature);
                            events.push({
                                state: 'leaving',
                                trackId: this.currentTrack.id,
                                feature
                            });
                        }
                        break;
                    }
                    case 'polygon': {
                        const g = geometry as Polygon;
                        const inside = insidePolygon([loc.lon, loc.lat], g.coordinates[0]);
                        const currentData = this.positionState[feature.id];
                        if (inside) {
                            this.positionState[feature.id] = {};
                            // this.handleEnteringFeature(this.currentTrack.id, feature, {
                            //     feature
                            // });
                            events.push({
                                state: currentData ? 'inside' : 'entering',
                                trackId: this.currentTrack.id,
                                feature
                            });
                        } else if (!inside && currentData) {
                            delete this.positionState[feature.id];
                            // this.handleLeavingFeature(this.currentTrack.id, feature);
                            events.push({
                                state: 'leaving',
                                trackId: this.currentTrack.id,
                                feature
                            });
                        }
                        break;
                    }
                    case 'marker': {
                        break;
                    }
                }
            });
            this.handleFeatureEvent(events);

            // if (DEV_LOG) {
            //     console.log('aimingFeature ', minDist, minFeature, nextPotentialIndex);
            // }
            // if (minDist < closestStoryStep) {
            this.aimingFeature = minFeature;
            // } else {
            //     this.aimingFeature = features.find((s) => {
            //         const name = 'index' in s.properties ? s.properties.index : s.properties.name;
            //         return name + '' === nextPotentialIndex + '';
            //     });
            // }
            // console.log('computedBearing', loc.computedBearing, loc.hasOwnProperty('computedBearing'), !!this.aimingFeature);
            if (loc.hasOwnProperty('computedBearing') && loc.computedBearing !== undefined) {
                if (this.aimingFeature) {
                    this.aimingAngle =
                        (determineAngleDeviationFromNorth(
                            { longitude: loc.lon, latitude: loc.lat },
                            { longitude: this.aimingFeature.geometry.center[0], latitude: this.aimingFeature.geometry.center[1] }
                        ) +
                            360 -
                            loc.computedBearing) %
                        360;
                } else {
                    this.aimingAngle = Infinity;
                }
                let audioFolder;
                //we are not inside any story feature
                if (
                    this.aimingAngle !== Infinity &&
                    (!this.insideFeature || (this.insideFeature && !isNumber(this.insideFeature.properties.name) && this.insideFeature.properties.name.endsWith('_out')))
                ) {
                    let newAimingDirection;
                    if (Math.abs(this.aimingAngle) <= 45 || Math.abs(this.aimingAngle) >= 315) {
                        newAimingDirection = 'forward';
                    } else if (this.aimingAngle >= 225 && this.aimingAngle <= 315) {
                        newAimingDirection = 'left';
                    } else if (this.aimingAngle >= 45 && this.aimingAngle <= 135) {
                        newAimingDirection = 'right';
                    } else if (this.aimingAngle >= 135 && this.aimingAngle <= 225) {
                        newAimingDirection = 'uturn';
                        if (!this.isInTrackBounds) {
                            newAimingDirection = 'exit';
                            audioFolder = path.join(getGlassesImagesFolder(), 'navigation', 'exit');
                        }
                    } else {
                        // this.bluetoothHandler.stopNavigationInstruction();
                    }
                    // console.log('newAimingDirection', this.aimingAngle, newAimingDirection, this.mLastAimingDirection, this.mLastPlayedAimingDirection);
                    if (this.mLastAimingDirection !== newAimingDirection) {
                        this.mLastAimingDirection = newAimingDirection;
                        this.mLastPlayedAimingDirection = null;
                    } else if (
                        this.mLastPlayedAimingDirection !== newAimingDirection && // play instruction on second consecutive same instruction(prevents jumps)
                        (!this.mLastPlayedAimingDirectionTime || Date.now() - this.mLastPlayedAimingDirectionTime > 5000) && // only play an instruction every 5s (prevent back / forth)
                        (!this.bluetoothHandler.isPlaying || this.bluetoothHandler.isPlayingNavigationInstruction) // dont play if playing important thing
                    ) {
                        this.mLastPlayedAimingDirection = newAimingDirection;
                        if (newAimingDirection) {
                            this.mLastPlayedAimingDirectionTime = Date.now();
                            this.bluetoothHandler.playNavigationInstruction(newAimingDirection, { audioFolder });
                        } else {
                            // this.mLastPlayedAimingDirectionTime = null;
                        }
                    }
                } else {
                    this.mLastPlayedAimingDirectionTime = null;
                    this.mLastPlayedAimingDirection = null;
                    this.mLastAimingDirection = null;
                }
            }

            // console.log('this.aimingAngle', this.aimingAngle);
        }
    }

    @bind
    onLocation(loc: GeoLocation, manager?: any) {
        // DEV_LOG && console.log('onLocation', loc.lat, loc.lon);
        if (this.lastLocation && getDistance(this.lastLocation, loc) > 1) {
            loc.computedBearing = bearing(this.lastLocation, loc);
        } else {
            loc.computedBearing = this.lastLocation?.computedBearing;
        }
        this.lastLocation = loc;
        // ensure we update before notifying
        this.updateTrackWithLocation(loc);
        this.notify({
            eventName: UserRawLocationEvent,
            object: this,
            location: loc,
            aimingFeature: this.aimingFeature,
            aimingAngle: this.aimingAngle,
            isInTrackBounds: this.isInTrackBounds
        } as UserLocationdEventData);
        // if (DEV_LOG) {
        //     console.log(TAG, 'onLocation', JSON.stringify(loc));
        // }

        if (manager && this._isIOSBackgroundMode && !this._deferringUpdates) {
            this._deferringUpdates = true;
            manager.allowDeferredLocationUpdatesUntilTraveledTimeout(0, 10);
        }
    }
    @bind
    onLocationError(err: Error) {
        if (DEV_LOG) {
            console.log(TAG, ' location error: ', err);
        }
        this.notify({
            eventName: UserRawLocationEvent,
            object: this,
            error: err
        } as UserLocationdEventData);
    }
    startWatch() {
        const options: GeolocationOptions = { minimumUpdateTime, desiredAccuracy, onDeferred: this.onDeferred, nmeaAltitude: true, skipPermissionCheck: true };
        if (__IOS__) {
            // if (this._isIOSBackgroundMode) {
            //     options.pausesLocationUpdatesAutomatically = false;
            //     options.allowsBackgroundLocationUpdates = true;
            //     options.activityType = CLActivityType.Fitness;
            // } else {
            geolocation.iosChangeLocManager.showsBackgroundLocationIndicator = true;
            options.pausesLocationUpdatesAutomatically = false;
            options.allowsBackgroundLocationUpdates = true;
            //@ts-ignore
            options.activityType = CLActivityType.OtherNavigation;
            // }
        } else {
            options.provider = 'gps';
        }
        if (DEV_LOG) {
            console.log(TAG, 'startWatch', options);
        }

        return geolocation.watchLocation<LatLonKeys>(this.onLocation, this.onLocationError, options).then((id) => (this.watchId = id));
    }

    stopWatch() {
        if (DEV_LOG) {
            console.log(TAG, 'stopWatch', this.watchId);
        }
        if (this.watchId) {
            geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    isWatching() {
        return !!this.watchId;
    }

    async stopSession(finish = false) {
        DEV_LOG && console.log(TAG, 'stopSession', finish);
        this.actualSessionStop(true);
        this.featuresViewed = [];
        this.insideFeature = null;
        this._playedHistory = [];
        this._isInTrackBounds = false;
        this.aimingAngle = 0;
        this.bluetoothHandler.stopSession(!finish);
    }
    async pauseSession() {
        this.actualSessionStop();
    }
    async askForSessionPerms() {
        await this.enableLocation();
    }

    async askAndStartSession() {
        await this.askForSessionPerms();
        return this.startSession();
    }
    async startSession() {
        this.actualSessionStart(true);
        await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
        this.bluetoothHandler.playInstruction('start', { force: true });
    }

    async resumeSession() {
        if (this.sessionState === SessionState.PAUSED) {
            await this.enableLocation();
            this.actualSessionStart();
        }
    }
    @bind
    importJSONFile(filePath: string) {
        const file = File.fromPath(filePath);
        // console.log(TAG,'importJSONFile', filePath, file.size);
        return file.readText().then((r) => this.importJSONString(r));
    }
    @bind
    importJSONString(value: string): Promise<Track> {
        return Promise.resolve().then(() => {
            if (!value || value.length === 0) {
                throw new Error('empty_file ' + value);
            }
            // return Promise.resolve().then(() => {

            if (DEV_LOG) {
                console.log(TAG, 'importJSONString', value, value.length);
            }

            const data = JSON.parse(value);
            return null;

            // const runningSession = {
            //     id: data.id,
            //     startTime: new Date(data.startTime),
            //     endTime: new Date(data.endTime),
            //     name: data.name,
            //     desc: data.desc,
            //     pauseDuration: data.pauseDuration,
            //     pauses: data.pauses,
            //     distance: data.distance,
            //     positions: data.__rawroute__.positions
            // } as RunningSession;

            // return this.dbHandler.saveRunningSession(runningSession, this.filteredLocationsTolerance);
        });
    }

    // @bind
    // importGPXFile(filePath: string) {
    //     return File.fromPath(filePath)
    //         .readText()
    //         .then((r) => this.importGPXString(r));
    // }

    // async importGPXString(value: string) {
    //     if (!value || value.length === 0) {
    //         throw new Error($t('empty_file'));
    //     }
    //     // if (DEV_LOG) {
    //     // console.log(TAG,'importGPXString', value);
    //     // }
    //     // console.log('importXMLString', value);
    //     return parseGPX(value).then((gpx) => {
    //         // console.log('gpx2', gpx);
    //         // return Promise.resolve().then(() => {
    //         const trk = gpx.trk[0] || gpx.trk;
    //         const trkseg = trk.trkseg[0] || trk.trkseg;
    //         const locs = trkseg.trkpt as any[];
    //         const coordinates = [];
    //         const geojson = {
    //             name: gpx.metadata.name,
    //             geometry: {
    //                 type: 'FeatureCollection',
    //                 features: [
    //                     {
    //                         type: 'LineString',
    //                         properties: {},
    //                         coordinates: locs.map((l) => [Math.round(parseFloat(l.$.lon) * 1000000) / 1000000, Math.round(parseFloat(l.$.lat) * 1000000) / 1000000])
    //                     } as LineString
    //                 ]
    //             }
    //         } as unknown as TrackFeatureCollection;
    //         bboxify(geojson);
    //         const track = new Track(Date.now());
    //         track.name = trk.name;
    //         track.geometry = geojson;
    //         track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.extent[2], lon: geojson.extent[3] }, { lat: geojson.extent[0], lon: geojson.extent[1] });
    //         return track.save();
    //     });
    // }
}
