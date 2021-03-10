import { GPS, GenericGeoLocation, Options as GeolocationOptions, LocationMonitor, setGeoLocationKeys, setMockEnabled } from '@nativescript-community/gps';
import * as perms from '@nativescript-community/perms';
import { TNSTextToSpeech } from '@nativescript-community/texttospeech';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import {
    AndroidActivityResultEventData,
    AndroidApplication,
    ApplicationEventData,
    android as androidApp,
    off as applicationOff,
    on as applicationOn,
    resumeEvent,
    suspendEvent
} from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { File } from '@nativescript/core/file-system';
import { Accuracy } from '@nativescript/core/ui/enums/enums';
import { Feature, LineString, Point, Polygon } from 'geojson';
import { bind } from 'helpful-decorators';
import { bearing } from '~/helpers/geo';
import { parseGPX } from '~/helpers/gpx';
import { $t, $tc } from '~/helpers/locale';
import { confirm } from '~/utils/dialogs';
import { TO_DEG, bboxify, computeAngleBetween, computeDistanceBetween, distanceToEnd, isLocactionInBbox, isLocationOnPath } from '~/utils/geo';
import Track, { GeometryProperties, TrackFeatureCollection, TrackGeometry } from '../models/Track';
import { BluetoothHandler } from './BluetoothHandler';
import { DBHandler } from './DBHandler';
const determineAngleDeviationFromNorth = require('angle-deviation-from-north');
const insidePolygon = require('point-in-polygon');

setGeoLocationKeys('lat', 'lon', 'altitude');
const TTS = new TNSTextToSpeech();
TTS.init();

export type GeoLocation = GenericGeoLocation<LatLonKeys> & {
    computedBearing?: number;
};

let geolocation: GPS;

//@ts-ignore
export const desiredAccuracy = global.isAndroid ? Accuracy.high : kCLLocationAccuracyBestForNavigation;
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
    _playedHistory = [];
    aimingAngle = 0;
    gpsEnabled = true;
    isSessionPaused() {
        return this.sessionState === SessionState.PAUSED;
    }

    setSessionState(state: SessionState) {
        if (this.sessionState === state) {
            return;
        }
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

    stop() {
        // console.log(TAG,'stop');
        return Promise.resolve().then(() => {
            this.stopSession();
            this.launched = false;
            geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
            applicationOff(suspendEvent, this.onAppPause, this);
            applicationOff(resumeEvent, this.onAppResume, this);
            return this.dbHandler.stop();
        });
    }
    set isInTrackBounds(value: boolean) {
        if (this._isInTrackBounds !== value) {
            this._isInTrackBounds = value;
            this.notify({
                eventName: OuterRingEvent,
                object: this,
                data: {
                    isInBounds: this._isInTrackBounds
                }
            });
        }
    }
    get isInTrackBounds() {
        return this._isInTrackBounds;
    }
    set currentTrack(track: Track) {
        this._currentTrack = track;
        this._isInTrackBounds = false;
        if (track) {
            appSettings.setString('selectedTrackId', track.id);
        } else {
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
        console.log(TAG, 'start');

        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);

        const gpsEnabled = await this.checkLocationPerm();
        // set to true if not allowed yet for the UI
        this.gpsEnabled = !gpsEnabled || geolocation.isEnabled();
        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);
        try {
            await this.dbHandler.start();
            const selectedTrackId = appSettings.getString('selectedTrackId');
            console.log('selectedTrackId', selectedTrackId);
            if (selectedTrackId) {
                const track = await Track.findOne(selectedTrackId);
                // console.log('track', !!track);
                if (track) {
                    this.currentTrack = track;
                }
            }
            console.log('dbHandler', 'started');
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
    async checkLocationPerm() {
        const r = await perms.check('location', { type: global.isAndroid ? 'always' : undefined });
        return (Array.isArray(r) && r[0] !== 'authorized') || Object.keys(r).some((s) => r[s] !== 'authorized');
    }
    async authorizeLocation() {
        const result = await perms.request('location', { type: global.isAndroid ? 'always' : undefined });
        if ((Array.isArray(result) && result[0] !== 'authorized') || Object.keys(result).some((s) => result[s] !== 'authorized')) {
            throw new Error('gps_denied');
        }
        this.gpsEnabled = geolocation.isEnabled();
        return result;
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
        if (global.isIOS) {
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
    async handleLeavingFeature(trackId: string, feature: Feature<TrackGeometry, GeometryProperties>) {
        this.speakText($t('leaving_feature', feature.properties.name));
        this.insideFeature = null;
        this.notify({
            eventName: PositionStateEvent,
            object: this,
            data: {
                feature,
                trackId,
                state: 'leaving'
            }
        });
    }
    insideFeature: Feature<TrackGeometry, GeometryProperties> = null;
    async handleEnteringFeature(trackId: string, feature: Feature<TrackGeometry, GeometryProperties>, extraData) {
        this.speakText($t('entering_feature', feature.properties.name));
        this.insideFeature = feature;
        this.bluetoothHandler.stopPlayingLoop();
        this.notify({
            eventName: PositionStateEvent,
            object: this,
            data: {
                ...extraData,
                trackId,
                feature,
                state: 'entering'
            }
        });
    }
    handleInsideFeature(trackId: string, feature: Feature<TrackGeometry, GeometryProperties>, extraData) {
        this.notify({
            eventName: PositionStateEvent,
            object: this,
            data: {
                ...extraData,
                trackId,
                feature,
                state: 'inside'
            }
        });
    }

    playStory(index: string) {
        const rindex = parseInt(index, 10);
        if (this._playedHistory.indexOf(rindex) === -1) {
            this._playedHistory.push(rindex);
        }
        console.log('playStory', index, rindex, this._playedHistory);
    }

    updateTrackWithLocation(loc: GeoLocation) {
        if (this.currentTrack) {
            const features = this.currentTrack.geometry.features;

            const outerRing = features.find((f) => f.properties.index === 'outer_ring');
            if (outerRing) {
                this.isInTrackBounds = isLocactionInBbox(loc, outerRing.bbox, 0);
            }
            let minFeature: Feature<TrackGeometry, GeometryProperties> = null;
            let minDist = Number.MAX_SAFE_INTEGER;
            let nextPotentialIndex = Math.max(0, ...this._playedHistory) + 1;
            for (let index = nextPotentialIndex; index > 0; index--) {
                if (this._playedHistory.indexOf(index) === -1) {
                    nextPotentialIndex = index;
                }
            }
            const currentPosition = [loc.lon, loc.lat];
            features.forEach((feature) => {
                const properties = feature.properties;
                if (properties.index === 'outer_ring') {
                    return;
                }
                const dist = computeDistanceBetween(feature.geometry.center, currentPosition);
                if (dist < minDist) {
                    minDist = dist;
                    minFeature = feature;
                }
                // add a bit of delta (m)
                const isInBounds = isLocactionInBbox(loc, feature.bbox, 0);
                if (!isInBounds) {
                    if (this.positionState[feature.id]) {
                        delete this.positionState[feature.id];
                        // we are getting out
                        this.handleLeavingFeature(this.currentTrack.id, feature);
                    }
                    return;
                }
                // we are in bounds!
                const geometry = feature.geometry;
                switch (properties.shape.toLowerCase()) {
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
                                this.handleInsideFeature(this.currentTrack.id, feature, {
                                    feature,
                                    index,
                                    distance
                                });
                            } else {
                                this.handleEnteringFeature(this.currentTrack.id, feature, {
                                    feature,
                                    index,
                                    distance
                                });
                            }
                        } else {
                            const currentData = this.positionState[feature.id];
                            if (currentData) {
                                delete this.positionState[feature.id];
                                this.handleLeavingFeature(this.currentTrack.id, feature);
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
                                this.handleInsideFeature(this.currentTrack.id, feature, {
                                    feature,
                                    distance
                                });
                            } else {
                                this.handleEnteringFeature(this.currentTrack.id, feature, {
                                    feature,
                                    distance
                                });
                            }
                        } else if (currentData) {
                            delete this.positionState[feature.id];
                            this.handleLeavingFeature(this.currentTrack.id, feature);
                        }
                        break;
                    }
                    case 'polygon': {
                        const g = geometry as Polygon;
                        const inside = insidePolygon([loc.lon, loc.lat], g.coordinates[0]);
                        const currentData = this.positionState[feature.id];
                        if (inside && !currentData) {
                            this.positionState[feature.id] = {};
                            this.handleEnteringFeature(this.currentTrack.id, feature, {
                                feature
                            });
                        } else if (!inside && currentData) {
                            delete this.positionState[feature.id];
                            this.handleLeavingFeature(this.currentTrack.id, feature);
                        }
                        break;
                    }
                    case 'marker': {
                        break;
                    }
                }
            });
            if (minDist < 100) {
                this.aimingFeature = minFeature;
            } else {
                this.aimingFeature = features.find((s) => s.properties.index === nextPotentialIndex + '');
            }
            this.aimingAngle = this.aimingFeature
                ? (determineAngleDeviationFromNorth({ longitude: loc.lon, latitude: loc.lat }, { longitude: this.aimingFeature.geometry.center[0], latitude: this.aimingFeature.geometry.center[1] }) +
                      360 -
                      loc.computedBearing) %
                  360
                : 0;
            // console.log('this.aimingAngle', this.aimingAngle);
            if (!this.insideFeature && !!this.bluetoothHandler.glasses) {
                if (Math.abs(this.aimingAngle) <= 18 || Math.abs(this.aimingAngle) >= 342) {
                    this.bluetoothHandler.playGoStraightLoop();
                } else if (this.aimingAngle >= 270 && this.aimingAngle <= 306) {
                    this.bluetoothHandler.playGoLeftLoop();
                } else if (this.aimingAngle >= 54 && this.aimingAngle <= 90) {
                    this.bluetoothHandler.playGoRightLoop();
                } else if (this.aimingAngle >= 160 && this.aimingAngle <= 200) {
                    this.bluetoothHandler.playGoBackLoop();
                } else {
                    this.bluetoothHandler.stopPlayingLoop();
                }
            }
        }
    }

    @bind
    onLocation(loc: GeoLocation, manager?: any) {
        if (this.lastLocation) {
            loc.computedBearing = bearing(this.lastLocation, loc);
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
        if (DEV_LOG) {
            // console.log(TAG,'onLocation', JSON.stringify(loc));
        }

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
        if (global.isIOS) {
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
            // options.provider = 'gps';
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

    async stopSession() {
        this.actualSessionStop(true);
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
        return this.actualSessionStart(true);
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

    @bind
    importGPXFile(filePath: string) {
        return File.fromPath(filePath)
            .readText()
            .then((r) => this.importGPXString(r));
    }

    async importGPXString(value: string) {
        if (!value || value.length === 0) {
            throw new Error($t('empty_file'));
        }
        // if (DEV_LOG) {
        // console.log(TAG,'importGPXString', value);
        // }
        // console.log('importXMLString', value);
        return parseGPX(value).then((gpx) => {
            // console.log('gpx2', gpx);
            // return Promise.resolve().then(() => {
            const trk = gpx.trk[0] || gpx.trk;
            const trkseg = trk.trkseg[0] || trk.trkseg;
            const locs = trkseg.trkpt as any[];
            const coordinates = [];
            const geojson = ({
                name: gpx.metadata.name,
                geometry: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'LineString',
                            properties: {},
                            coordinates: locs.map((l) => [Math.round(parseFloat(l.$.lon) * 1000000) / 1000000, Math.round(parseFloat(l.$.lat) * 1000000) / 1000000])
                        } as LineString
                    ]
                }
            } as unknown) as TrackFeatureCollection;
            bboxify(geojson);
            const track = new Track(Date.now());
            track.name = trk.name;
            track.geometry = geojson;
            track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.extent[2], lon: geojson.extent[3] }, { lat: geojson.extent[0], lon: geojson.extent[1] });
            return track.save();
        });
    }
}
