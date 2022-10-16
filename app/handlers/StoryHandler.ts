import { TNSPlayer } from '@akylas/nativescript-audio';
import { EventData } from '@nativescript-community/ui-image';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ApplicationSettings, File, Folder, path } from '@nativescript/core';
import { isNumber } from '@nativescript/core/utils/types';
import { AdditiveTweening } from 'additween';
import dayjs from 'dayjs';
import { filesize } from 'filesize';
import { Feature, LineString, Point, Polygon } from 'geojson';
import { bind } from 'helpful-decorators';
import { DURATION_FORMAT, formatDuration } from '~/helpers/formatter';
import { bearing } from '~/helpers/geo';
import { $tc } from '~/helpers/locale';
import * as ProgressNotification from '~/services/android/ProgressNotifications';
import { MessageError } from '~/services/CrashReportService';
import { hashCode, timeout } from '~/utils';
import { computeDistanceBetween, distanceToEnd, distanceToPolygon, isLocactionInBbox, isLocationOnPath } from '~/utils/geo';
import { getGlassesImagesFolder, throttle } from '~/utils/utils';
import Track, { GeometryProperties, TrackFeature, TrackGeometry } from '../models/Track';
import { BLEConnectionEventData, CancelPromise, Command, FADING_SUPPORTED, GlassesConnectedEvent, GlassesDisconnectedEvent, GlassesReadyEvent } from './BluetoothHandler';
import { GPSEvent, GeoLocation, SessionEventData, SessionState, SessionStateEvent, getDistance } from './GeoHandler';
import { Handler } from './Handler';
import Lyric from './Lyric';
import { CommandType, FULLSCREEN, FreeSpaceData, InputCommandType } from './Message';

export { Track as Session };

function shuffleArray(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

function getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export interface UserLocationdEventData extends GPSEvent {
    aimingFeature?: Feature<TrackGeometry, GeometryProperties>;
    aimingAngle?: number;
    isInTrackBounds?: boolean;
}

export const TrackSelecteEvent = 'trackSelected';
export const PositionStateEvent = 'positionState';
export const InsideFeatureEvent = 'insideFeature';
export const FeatureViewedEvent = 'storyPlayed';
export const OuterRingEvent = 'outer_ring';
export const AimingFeatureEvent = 'aimingFeature';
export const AvailableStoriesEvent = 'availableStories';
export const PlaybackEvent = 'playback';
export const PlaybackStartEvent = 'playbackStart';
export const DrawBitmapEvent = 'drawBitmap';

const determineAngleDeviationFromNorth = require('angle-deviation-from-north');
const insidePolygon = require('point-in-polygon');
const geojsonArea = require('@mapbox/geojson-area');

export interface PlayImagesOptions {
    frameDuration?;
    randomize?;
    loopReverse?;
    iterations?;
    useCrop?;
}
export interface PlayInstructionOptions extends PlayImagesOptions {
    audioFolder?: string;
    audioFiles?: string[];
    delay?;
    queue?;
    force?;
    noAudio?;
    randomAudio?: boolean;
    loop?: boolean;
    instruction?;
}

export interface PlayingInfo {
    canPause?: boolean;
    canStop?: boolean;
    showPlayBar?: boolean;
    duration: number;
    name: any;
    description?: any;
    cover?: string;
}

const TAG = '[Story]';
export class StoryHandler extends Handler {
    positionState: { [k: string]: any } = {};
    _currentTrack: Track;
    _isInTrackBounds = false;
    _aimingFeature: Feature<TrackGeometry, GeometryProperties> = null;
    _playedHistory: number[] = [];
    _playedPastille: number[] = [];
    _featuresViewed: string[] = [];
    aimingAngle = Infinity;
    _insideFeature: TrackFeature = null;
    // mReadableStories: number[] = null;
    lastLocation?: GeoLocation;

    mPlayer = new TNSPlayer();

    currentLoop: string = null;
    isPlaying = false;
    isPlayingPaused = false;
    isPlayingStory = 0;
    isPlayingMusic = false;
    isPlayingPastille = 0;
    isPlayingNavigationInstruction = null;
    canStopStoryPlayback = false;
    toPlayNext: Function = null;

    get playerCurrentTime() {
        return this.mPlayer?.currentTime || 0;
    }
    get isInLoop() {
        return this.currentLoop !== null;
    }
    get playerState() {
        if (this.isPlayingStory || this.isPlayingPastille) {
            return this.isPlayingPaused ? 'pause' : 'play';
        }
        return 'stopped';
    }
    storiesInfo: { [k: number]: { title: string; cover: string } } = {};
    get storyInfo() {
        return (id: string) => {
            if (!this.storiesInfo[id]) {
                const filePath = path.join(getGlassesImagesFolder(), 'stories', id, 'metadata.json');
                DEV_LOG && console.log('storyInfo', id, filePath);
                this.storiesInfo[id] = JSON.parse(File.fromPath(filePath).readTextSync());
            }
            return this.storiesInfo[id];
        };
    }
    get playingInfo(): PlayingInfo {
        if (this.isPlayingStory || this.isPlayingPastille) {
            const storyInfo = this.isPlayingStory && this.storyInfo(this.isPlayingStory + '');
            DEV_LOG && console.log('playingInfo', storyInfo, this.canStopStoryPlayback);
            return {
                canPause: true,
                canStop: !PRODUCTION || this.canStopStoryPlayback,
                showPlayBar: true,
                duration: this.mPlayer?.duration || 0,
                name: this.isPlayingStory ? storyInfo.title : `Pastille: ${this.isPlayingPastille}`,
                description: this.isPlayingStory ? storyInfo.description : undefined,
                cover: this.isPlayingStory ? path.join(getGlassesImagesFolder(), 'stories', this.isPlayingStory + '', storyInfo.cover) : path.join(getGlassesImagesFolder(), 'pastilles', 'cover.png')
            };
        } else if (this.isPlaying) {
            return {
                duration: this.mPlayer?.duration || 0,
                canPause: false,
                name: this.isPlayingNavigationInstruction
            };
        }
        return { duration: 0, name: null };
    }

    get sessionState() {
        return this.geoHandler.sessionState;
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
    // setReadableStories(arg0: number[]) {
    //     this.mReadableStories = arg0;
    //     this.notify({ eventName: AvailableStoriesEvent, data: arg0 });
    // }

    set isInTrackBounds(value: boolean) {
        if (this._isInTrackBounds !== value) {
            // console.log('isInTrackBounds', value);
            this._isInTrackBounds = value;
            if (!value) {
                this.playNavigationInstruction('exit');
            } else {
                // stop instruction
                // this.bluetoothHandler.stopNavigationInstruction();
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
        TEST_LOG && console.log('set currentTrack', track?.id, track?.name);
        if (track) {
            ApplicationSettings.setString('selectedTrackId', track.id);
        } else {
            ApplicationSettings.remove('selectedTrackId');
        }

        this.notify({ eventName: TrackSelecteEvent, track });
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

    async stop() {
        DEV_LOG && console.log(TAG, 'stop');
        this.geoHandler.removeOnLocationAugmenter(this.onLocation);
        this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandler.off(GlassesConnectedEvent, this.onGlassesConnected, this);
        this.geoHandler.off(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
        DEV_LOG && console.log(TAG, 'stop done');
    }
    async start() {
        try {
            DEV_LOG && console.log(TAG, 'start');
            this.geoHandler.addOnLocationAugmenter(this.onLocation);
            this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler.on(GlassesConnectedEvent, this.onGlassesConnected, this);
            this.geoHandler.on(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
            const selectedTrackId = ApplicationSettings.getString('selectedTrackId');
            if (selectedTrackId) {
                const track = await this.dbHandler.getItem(selectedTrackId);
                if (track) {
                    this.currentTrack = track;
                }
            }
        } catch (err) {
            console.error('dbHandler', 'start error', err, err.stack);
            return Promise.reject(err);
        }
    }

    markAsViewed(featureId: string) {
        const featuresViewed = this.featuresViewed;

        if (featuresViewed.indexOf(featureId) === -1) {
            featuresViewed.push(featureId);
            featuresViewed.push(featureId + '_out');
        }
        this.featuresViewed = featuresViewed;
    }
    set insideFeature(value) {
        if (value !== this._insideFeature) {
            this._insideFeature = value;

            const playing = this.isPlayingStory || this.isPlayingMusic || this.isPlayingPastille;
            if (playing) {
                // We will get a new `inside` event when finished and thus `insideFeature` will be set again
                this._insideFeature = null;
                return;
            }
            // if (value && !playing) {
            if (value) {
                const name = ('index' in value.properties ? value.properties.index : value.properties.name) + '';
                DEV_LOG && console.log('insideFeature', name, this._playedHistory);
                if (name === 'exit' && this._playedHistory.length === 0) {
                    this._insideFeature = null;
                    return;
                }
                if (name.startsWith('pastille_')) {
                    const featureId = (name + '').split('_')[1];
                    this.markAsViewed(name);
                    const nextStoryIndex = parseInt(featureId, 10);
                    (async () => {
                        try {
                            DEV_LOG && console.log('about to start pastille', nextStoryIndex, this.isPlayingStory, this.isPlayingMusic, this.isPlayingPastille);
                            await this.stopPlayingInstruction();
                            this.playPastille(nextStoryIndex);
                        } catch (error) {
                            console.error('playPastille', error, error.stack);
                        }
                    })();
                } else if (name === 'exit' && this._playedHistory.length) {
                    console.log('stopping session because we went back to exit', this._playedHistory);
                    this.geoHandler.stopSession();
                } else {
                    const featureId = (name + '').split('_')[0];
                    const nextStoryIndex = parseInt(featureId, 10);
                    if (!isNaN(nextStoryIndex) && !this.isStoryPlayed(nextStoryIndex)) {
                        DEV_LOG && console.log('nextStoryIndex', nextStoryIndex);
                        const playableStories = Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories'))
                            .getEntitiesSync()
                            .filter((s) => Folder.exists(s.path))
                            .map((e) => parseInt(e.name, 10));
                        DEV_LOG && console.log('playableStories', playableStories);
                        if (playableStories.indexOf(nextStoryIndex) !== -1) {
                            this.markAsViewed(name);
                            this.loadAndPlayStory({ storyIndex: nextStoryIndex, canStop: this.isStoryPlayed(nextStoryIndex) });
                        }
                    } else {
                        // ensure we dont "block" with insideFeature set while not playing
                        this._insideFeature = null;
                    }
                }

                // if (this.mReadableStories) {
                //     nextStoryIndex = Math.max(0, Math.min(...this.mReadableStories.filter((item) => this._playedHistory.indexOf(item) === -1)));
                // } else {
                //     nextStoryIndex = Math.max(0, ...this._playedHistory) + 1;
                //     for (let index = nextStoryIndex; index > 0; index--) {
                //         if (this._playedHistory.indexOf(index) === -1) {
                //             nextStoryIndex = index;
                //         }
                //     }
                // }
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
        DEV_LOG &&
            console.log(
                'handleFeatureEvent',
                insideFeatures.length,
                insideFeatures.map((f) => [f.state, f.feature.properties.name])
            );
        let featureToEnter;
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
            featureToEnter = insideFeatures[minIndex].feature;
        } else if (insideFeatures.length === 1) {
            featureToEnter = insideFeatures[0].feature;
        } else {
            this.insideFeature = null;
        }
        if (featureToEnter) {
            if (!this._insideFeature) {
                this.insideFeature = featureToEnter;
            } else {
                // we already are in a feature we will enter the new one when the story/pastille is finished
                // console.log('we already are in a feature', 'we will enter the new one when the story/pastille is finished');
            }
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

    playedPastille(index: string) {
        const rindex = parseInt(index, 10);
        if (this._playedPastille.indexOf(rindex) === -1) {
            this._playedPastille.push(rindex);
        }
        DEV_LOG && console.log('playedPastille', index, rindex, this._playedPastille, !!this.insideFeature);
        if (this.insideFeature) {
            // we clear insideFeature as this feature is now played and thus
            // we should ignore it and notify of next aiming feature
            this.insideFeature = null;
        }
    }
    isStoryPlayed(index: number) {
        return this._playedHistory.indexOf(index) !== -1;
    }
    playedStory(index: string, markAsPlayedOnMap = true) {
        const rindex = parseInt(index, 10);
        if (markAsPlayedOnMap && !this.isStoryPlayed(rindex)) {
            this._playedHistory.push(rindex);
        }
        TEST_LOG && console.log('playedStory', index, rindex, this._playedHistory, !!this.insideFeature, markAsPlayedOnMap);
        if (markAsPlayedOnMap && this.insideFeature) {
            // we clear insideFeature as this feature is now played and thus
            // we should ignore it and notify of next aiming feature
            this.insideFeature = null;
        }
    }
    mLastAimingDirection: string;
    mLastPlayedAimingDirection: string;
    mLastPlayedAimingDirectionTime: number;
    async updateTrackWithLocation(loc: GeoLocation) {
        const minHorizontalAccuracy = ApplicationSettings.getNumber('minHorizontalAccuracy', 40);
        TEST_LOG && console.log('updateTrackWithLocation', loc.lat, loc.lon, loc.horizontalAccuracy, this.insideFeature?.properties.name, this._playedHistory);
        if (loc.horizontalAccuracy > minHorizontalAccuracy) {
            return;
        }
        if (this.insideFeature) {
            // we can ignore almost everything while inside a feature(playing story)
            this.mLastPlayedAimingDirectionTime = null;
            this.mLastPlayedAimingDirection = null;
            this.mLastAimingDirection = null;
            return;
        }
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
            let nextPotentialIndexDistance = Number.MAX_SAFE_INTEGER;

            // the aiming algorithm will tend to get you to the next story
            // except if you are very close(closestStoryStep) to another story

            const trackStories = features
                .filter((f) => f.properties.isStory || isNumber(f.properties.name))
                .map((f) => ('index' in f.properties ? f.properties.index : f.properties.name))
                .sort();

            let playedAll = false;
            // _playedHistory also contained 1000
            // const playedHistory = this._playedHistory.filter(s=>s!==1000);
            if (trackStories.length === this._playedHistory.length) {
                // we are done!
                playedAll = true;
            }
            let nextPotentialIndex = Math.max(0, ...this._playedHistory) + 1;
            for (let index = nextPotentialIndex; index > 0; index--) {
                if (!this.isStoryPlayed(index)) {
                    nextPotentialIndex = index;
                }
            }
            const currentPosition = [loc.lon, loc.lat];
            const events = [];
            features.forEach((feature) => {
                const properties = feature.properties;
                const name = 'index' in properties ? properties.index : properties.name;

                if (name === 'outer_ring' || this._featuresViewed.indexOf(name) !== -1 || (!playedAll && name === 'exit')) {
                    return;
                }

                // used to compute aiming feature
                if (feature.properties.isStory === true || isNumber(name) || (playedAll && name === 'exit')) {
                    const featureId = (name + '').split('_')[0];
                    if (this._featuresViewed.indexOf(featureId) !== -1) {
                        return;
                    }

                    const storyIndex = parseInt(featureId, 10);
                    const g = feature.geometry as Polygon;
                    const dist = distanceToPolygon(currentPosition, g);
                    // const dist = computeDistanceBetween(feature.geometry.center, currentPosition);
                    // DEV_LOG && console.log('updateTrackWithLocation in bounds!', name, feature.id, dist, minDist);
                    if (dist < minDist) {
                        minDist = dist;
                        minFeature = feature;
                    }
                    if (nextPotentialIndex === storyIndex) {
                        nextPotentialIndexDistance = dist;
                    }
                }

                // add a bit of delta (m)
                const isInBounds = isLocactionInBbox(loc, feature.bbox, 0);

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

            TEST_LOG &&
                console.log(
                    'updateTrackWithLocation',
                    JSON.stringify({
                        lat: loc.lat,
                        lon: loc.lon,
                        computedBearing: loc.computedBearing,
                        trackStories,
                        _playedHistory: this._playedHistory,
                        playedAll,
                        minDist,
                        name: minFeature?.properties.name,
                        nextPotentialIndex,
                        nextPotentialIndexDistance
                    })
                );
            if (playedAll || minDist < closestStoryStep || minDist <= nextPotentialIndexDistance / 2) {
                this.aimingFeature = minFeature;
            } else {
                this.aimingFeature = features.find((s) => {
                    const name = 'index' in s.properties ? s.properties.index : s.properties.name;
                    return name + '' === nextPotentialIndex + '';
                });
            }
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
                DEV_LOG && console.log('computedBearing', loc.computedBearing, loc.hasOwnProperty('computedBearing'), this.aimingAngle, !!this.aimingFeature);
            } else {
                this.aimingAngle = Infinity;
            }
            let audioFolder;
            //we are not inside any story feature
            if (this.aimingAngle !== Infinity && !this.insideFeature) {
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

                const instructionIntervalDuration = ApplicationSettings.getNumber('instructionIntervalDuration', 20000);
                const instructionRepeatDuration = ApplicationSettings.getNumber('instructionRepeatDuration', 20000);
                const now = Date.now();
                const deltaTime = this.mLastPlayedAimingDirectionTime ? now - this.mLastPlayedAimingDirectionTime : Number.MAX_SAFE_INTEGER;
                TEST_LOG &&
                    console.log(
                        'newAimingDirection',
                        JSON.stringify({
                            isPlaying: this.isPlaying,
                            aimingAngle: this.aimingAngle,
                            newAimingDirection,
                            mLastAimingDirection: this.mLastAimingDirection,
                            mLastPlayedAimingDirection: this.mLastPlayedAimingDirection,
                            mLastPlayedAimingDirectionTime: this.mLastPlayedAimingDirectionTime,
                            deltaTime
                        })
                    );
                let forcePlay = false;
                if (this.mLastAimingDirection !== newAimingDirection) {
                    // we are changing direction
                    forcePlay = this.mLastAimingDirection === null;
                    this.mLastAimingDirection = newAimingDirection;
                    this.mLastPlayedAimingDirection = null;
                }
                if (!this.isPlaying /* || this.bluetoothHandler.isPlayingNavigationInstruction */) {
                    // dont play if playing important thing)
                    if (
                        forcePlay /* first instruction */ ||
                        (!this.mLastPlayedAimingDirection && deltaTime > instructionIntervalDuration) /* new instruction */ ||
                        (this.mLastPlayedAimingDirection === newAimingDirection && deltaTime > instructionRepeatDuration) /* repeat instruction */
                    ) {
                        this.mLastPlayedAimingDirection = newAimingDirection;
                        if (newAimingDirection) {
                            try {
                                await this.playNavigationInstruction(newAimingDirection, { audioFolder });
                            } catch (error) {
                                console.error(error);
                            }
                            this.mLastPlayedAimingDirectionTime = Date.now();
                        } else {
                            TEST_LOG && console.log('clearing mLastPlayedAimingDirection');
                            this.mLastPlayedAimingDirectionTime = null;
                        }
                    }
                }
            } else {
                this.mLastPlayedAimingDirectionTime = null;
                this.mLastPlayedAimingDirection = null;
                this.mLastAimingDirection = null;
            }
        }
    }

    @bind
    onLocation(args) {
        const loc = args.location;
        if (!this.lastLocation) {
            this.lastLocation = loc;
        } else {
            const detectUserStopping = ApplicationSettings.getBoolean('detectUserStopping', false);
            const minDistanceDetection = ApplicationSettings.getNumber('minDistanceDetection', 1);
            const distance = getDistance(this.lastLocation, loc);
            if (distance > minDistanceDetection) {
                loc.computedBearing = bearing(this.lastLocation, loc);
                TEST_LOG && console.info('computed bearing', this.lastLocation, loc, distance, loc.computedBearing);
                this.lastLocation = loc;
            } else if (detectUserStopping && loc.timestamp - this.lastLocation.timestamp > 30000) {
                // the user stopped moving we reset and wait for him to move
                this.lastLocation = loc;
                // } else if (!detectUserStopping) {
                //     loc.computedBearing = this.lastLocation.computedBearing;
                //     this.lastLocation = loc;
            }
        }
        const state = this.sessionState;
        if (state === SessionState.RUNNING) {
            this.updateTrackWithLocation(this.lastLocation);
            Object.assign(args, {
                aimingFeature: this.aimingFeature,
                aimingAngle: this.aimingAngle,
                isInTrackBounds: this.isInTrackBounds
            });
        }
    }

    async stopSession(fade = true) {
        DEV_LOG && console.log(TAG, 'stopSession', fade);
        await this.stopPlayingLoop({ fade, ignoreNext: true });
        if (fade) {
            this.playInstruction('end');
        }
    }
    private async onSessionStateEvent(e: SessionEventData) {
        DEV_LOG && console.log(TAG, 'onSessionStateEvent', e.data);
        if ((e.data.oldState === SessionState.STOPPED && e.data.state === SessionState.RUNNING) || (e.data.oldState === SessionState.RUNNING && e.data.state === SessionState.STOPPED)) {
            this.featuresViewed = [];
            this.insideFeature = null;
            this._playedHistory = [];
            this._isInTrackBounds = false;
            this.aimingAngle = Infinity;
            // this.bluetoothHandler.clearFullScreen();
            // await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
            // if (PRODUCTION) {
            //     return this.bluetoothHandler.playInstruction('start', { force: true });
            // }
            // const currentConfigs = this.bluetoothHandler.currentConfigs;
            // const needsToLoadNav = currentConfigs?.findIndex((c) => c.name === 'nav') === -1;
            // if (needsToLoadNav) {
            //     const memory = await this.bluetoothHandler.getMemory();
            //     this.bluetoothHandler.sendConfigToGlasses(path.join(getGlassesImagesFolder(), 'navigation'), memory);
            // }
        } else if (e.data.oldState === SessionState.RUNNING && e.data.state === SessionState.STOPPED) {
            await this.stopPlayingLoop({ fade: true, ignoreNext: true });
            // this.bluetoothHandler.clearFullScreen();
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

            DEV_LOG && console.log(TAG, 'importJSONString', value, value.length);

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
    //         throw new Error(('empty_file'));
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

    onGlassesConnected(e: BLEConnectionEventData) {
        this.canDrawOnGlasses = true;
    }

    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.canDrawOnGlasses = false;
        // this.setReadableStories(null);
    }

    createPlayer() {
        this.mPlayer = new TNSPlayer();
    }
    async loadAndPlayStory({
        storyIndex,
        shouldPlayStart = PRODUCTION,
        shouldPlayMusic = false,
        shouldPlayRideau = false,
        canStop = false,
        markAsPlayedOnMap = true
    }: {
        storyIndex: number;
        shouldPlayStart?: boolean;
        shouldPlayMusic?: boolean;
        shouldPlayRideau?: boolean;
        canStop?: boolean;
        markAsPlayedOnMap?: boolean;
    }) {
        try {
            const wasSessionRunning = this.geoHandler.sessionState !== SessionState.STOPPED;
            DEV_LOG && console.log('loadAndPlayStory', storyIndex, shouldPlayStart, shouldPlayMusic, shouldPlayRideau, canStop);
            let needsToplayMusic = false;
            let configurationAlreadyLoaded = true;
            const featureId = storyIndex + '';
            const storyFolder = path.join(getGlassesImagesFolder(), 'stories', featureId);

            let currentConfigs;
            if (this.bluetoothHandler.currentConfigs) {
                currentConfigs = this.bluetoothHandler.currentConfigs.slice(0);
                configurationAlreadyLoaded = currentConfigs?.findIndex((c) => c.name === featureId) !== -1;
            }

            // for now we play music ONLY if we need to load the config
            if (shouldPlayMusic && /* name.endsWith('_out') || */ !configurationAlreadyLoaded) {
                needsToplayMusic = true;
            }
            DEV_LOG && console.log('nextStoryIndex', this._playedHistory, storyIndex, currentConfigs, configurationAlreadyLoaded, needsToplayMusic, shouldPlayStart);

            await this.stopPlayingInstruction();
            if (shouldPlayStart) {
                // TODO: play per story play instruction with playAudio
                let audioFiles;

                if (ApplicationSettings.getBoolean('perStoryMessages', true)) {
                    const startingStoryAudio = path.join(storyFolder, 'starting.mp3');
                    if (File.exists(startingStoryAudio)) {
                        audioFiles = [startingStoryAudio];
                    }
                }
                const promise = this.playInstruction('starting_story', { audioFiles });
                if (configurationAlreadyLoaded) {
                    await promise;
                    if (wasSessionRunning && this.geoHandler.sessionState === SessionState.STOPPED) {
                        // session aws stopped
                        return;
                    }
                }
            }

            if (needsToplayMusic) {
                // story will be queued after
                this.playMusic(storyIndex, !configurationAlreadyLoaded);
            }
            if (!configurationAlreadyLoaded) {
                const configsInMemory = currentConfigs
                    .map((c) => c.name)
                    .map((s) => parseInt(s, 10))
                    .filter((s) => !isNaN(s));
                const alreadyPlayedStoriesInMemory = configsInMemory.filter((value) => this._playedHistory.includes(value));
                DEV_LOG && console.log('alreadyPlayedStoriesInMemory', alreadyPlayedStoriesInMemory);

                let memory = await this.bluetoothHandler.getMemory();
                let availableSpace = memory.freeSpace;
                let needToGetMemoryAgain = false;

                const deleteConfig = async (configToRemove: string) => {
                    needToGetMemoryAgain = true;
                    const configData = currentConfigs.find((d) => d.name === `${configToRemove}`);
                    const configIndex = currentConfigs.findIndex((d) => d.name === `${configToRemove}`);
                    DEV_LOG && console.log('deleting config to get space', availableSpace, configToRemove, JSON.stringify(configData), configIndex);
                    await this.bluetoothHandler.deleteConfig(configData.name);
                    if (configIndex !== -1) {
                        currentConfigs.splice(configIndex, 1);
                    }
                    availableSpace += configData.size;
                    DEV_LOG && console.log('deleting config done', configToRemove, availableSpace);
                };
                for (let index = 0; index < alreadyPlayedStoriesInMemory.length; index++) {
                    const configToRemove = alreadyPlayedStoriesInMemory[index] + '';
                    // delete already played stories
                    DEV_LOG && console.log('deleting played config', configToRemove, availableSpace, needToGetMemoryAgain);
                    await deleteConfig(configToRemove);
                    DEV_LOG && console.log('deleted played config', configToRemove, availableSpace, needToGetMemoryAgain);
                }
                const newStorySize = JSON.parse(File.fromPath(path.join(storyFolder, 'info.json')).readTextSync()).totalImageSize;
                DEV_LOG && console.log('newStorySize', featureId, newStorySize, availableSpace);
                while (newStorySize >= availableSpace) {
                    // we need more space!
                    const configToRemove = configsInMemory.shift();
                    await deleteConfig(configToRemove + '');
                }
                DEV_LOG && console.log('needToGetMemoryAgain', availableSpace, needToGetMemoryAgain);
                if (needToGetMemoryAgain) {
                    // ask glasses memory again to ensue we have enough space!
                    memory = await this.bluetoothHandler.getMemory(true);
                }
                await this.sendConfigToGlasses(storyFolder, memory);
                await timeout(500);
                // music is looping we need to stop it
                this.stopPlayingLoop({ fade: true });
            }
            if (shouldPlayRideau) {
                await this.playRideauAndStory(storyIndex, markAsPlayedOnMap);
            } else {
                await this.playStory(storyIndex, shouldPlayStart, canStop, markAsPlayedOnMap);
            }
        } catch (error) {
            console.error('loadAndPlayStory', error, error.stack);
            this.notify({ eventName: 'error', data: error });
        }
    }

    async playInstructionImages(instruction: string, options?: PlayImagesOptions) {
        const instFolder = path.join(getGlassesImagesFolder(), `navigation/${instruction}`);
        DEV_LOG && console.log('playInstructionImages', instruction, instFolder, Folder.exists(instFolder));
        if (!Folder.exists(instFolder)) {
            return;
        }
        if (instruction) {
            this.isPlayingNavigationInstruction = instruction;
        }
        this.isPlaying = true;
        const files = await Folder.fromPath(instFolder).getEntities();
        const useCrop = this.setUsesCrop('navigation');
        options.useCrop = useCrop;
        const images = files
            .filter((f) => f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.bmp'))
            .map((f) => f.name)
            .sort();
        this.playOfImages(images, instFolder, options);
    }

    async playPastille(index) {
        DEV_LOG && console.log('playPastille', index, this.isPlaying);
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playPastille(index);
                    resolve();
                };
            });
        }
        try {
            this.isPlaying = true;
            this.isPlayingPastille = index;
            const storyFolder = path.join(getGlassesImagesFolder(), 'pastilles');
            this.bluetoothHandler.clearFadeout();
            this.playInstructionImages('eye', { iterations: 2, frameDuration: 200, loopReverse: true });
            await this.playAudio({ fileName: path.join(storyFolder, `pastille_${index}.mp3`), notify: true });
            DEV_LOG && console.log('playPastille done', index, this.isPlaying);
            this.playedPastille(index + '');
            this.notify({ eventName: PlaybackEvent, data: 'stopped' });
        } catch (error) {
            console.error('playPastille error', error, error.stack);
        } finally {
            DEV_LOG && console.log('finished playing playPastille');
            this.stopPlayingLoop();
        }
    }

    async playMusic(index, loop = false) {
        this.isPlayingMusic = true;
        try {
            await this.playInstruction('music', { randomAudio: true, loop });
        } finally {
            this.isPlayingMusic = false;
            this.stopPlayingLoop();
        }
    }

    async stopPlayingInstruction(fade = true) {
        if (this.isPlaying && !this.isPlayingMusic && !this.isPlayingStory && !this.isPlayingPastille) {
            return this.stopPlayingLoop({ fade });
        }
    }

    async stopNavigationInstruction(fade = true) {
        if (this.isPlayingNavigationInstruction) {
            return this.stopPlayingLoop({ fade });
        }
    }

    async stopPlayingLoop({ fade = false, ignoreNext = false, instruction = false } = {}) {
        // if (!this.isPlaying) {
        //     return;
        // }
        // DEV_LOG && console.log('stopPlayingLoop', fade, ignoreNext, instruction, this.mPlayer.isAudioPlaying());
        if (instruction && !this.isPlayingNavigationInstruction) {
            return;
        }
        TEST_LOG && console.log('stopPlayingLoop', fade, ignoreNext, instruction, this.mPlayer.isAudioPlaying(), this.isPlayingStory, this.isPlayingPastille, !!this.toPlayNext);

        const onDone = async () => {
            // we need to wait to set those otherwise another instruction might want to start
            // before onDone and it could break the state machine
            this.isPlaying = false;
            this.isPlayingPaused = false;
            this.isPlayingMusic = false;
            if (this.isPlayingStory || this.isPlayingPastille) {
                this.isPlayingPastille = 0;
                this.isPlayingStory = 0;
                this.notify({ eventName: PlaybackEvent, data: 'stopped' });
            }
            if (this.lyric) {
                this.lyric.pause();
                this.lyric = null;
            }
            if (this.currentLoop) {
                this.currentLoop = null;
                // await this.fadeout();
            }
            DEV_LOG && console.log('stopPlayingLoop onDone', ignoreNext, !!this.toPlayNext);
            this.mPlayer.pause();
            this.mPlayer['_options']?.errorCallback();
            try {
                await this.mPlayer.dispose();
            } catch (err) {
                console.error('error disposing player', err, err.stack);
            }
            this.mPlayer = new TNSPlayer();
            if (!ignoreNext && this.toPlayNext) {
                this.toPlayNext();
            }
            this.toPlayNext = null;
        };
        if (this.mPlayer.isAudioPlaying()) {
            if (fade) {
                try {
                    await new Promise((resolve) => {
                        const anim = new AdditiveTweening({
                            onRender: (obj) => {
                                this.mPlayer.volume = obj.value;
                            },
                            onFinish: resolve
                        });
                        anim.tween({ value: 1 }, { value: 0 }, 500);
                    });
                } catch (error) {
                    console.error('audio fade tween', error, error.stack);
                } finally {
                    await onDone();
                }
            } else {
                await onDone();
            }
        } else {
            await onDone();
        }
        this.sendImageToDraw(null);
        if (fade) {
            this.fadeout();
        } else {
            this.bluetoothHandler.clearFullScreen();
        }
    }

    currentSentImageToDraw: string = null;
    sendImageToDraw(imagePath: string) {
        this.currentSentImageToDraw = imagePath;
        this.notify({ eventName: DrawBitmapEvent, bitmap: imagePath });
    }
    isFaded = false;
    async fadeout() {
        if (FADING_SUPPORTED) {
            this.isFaded = true;
        }
        this.bluetoothHandler.fadeout();
    }
    async clearFadeout() {
        if (FADING_SUPPORTED && this.isFaded) {
            this.isFaded = false;
        }
        this.bluetoothHandler.clearFadeout();
    }

    async playOfImages(images: string[], imagesFolder, options?: PlayImagesOptions) {
        // if (!this.canDrawOnGlasses) {
        //     return;
        // }
        const bluetoothHandler = this.bluetoothHandler;
        const myLoop = images.join('');
        // DEV_LOG && console.log('playOfImages', images, imagesFolder, myLoop, this.currentLoop, options, this.isFaded);
        if (images.length === 0 || this.currentLoop === myLoop) {
            return;
        }
        this.currentLoop = myLoop;
        bluetoothHandler.clearFadeout();
        // await this.startLoop();
        // this.fadein();
        let loopIndex = 0;
        const iterations = options?.hasOwnProperty('iterations') ? options.iterations : 1;
        const imageMap = this.navigationImageMap;
        const useCrop = this.setUsesCrop('navigation');
        DEV_LOG && console.log('playOfImages', JSON.stringify({ images, imagesFolder, myLoop, options, isFaded: this.isFaded, iterations, loopIndex }));
        if (bluetoothHandler.glasses) {
            bluetoothHandler.setConfig('nav');
        }
        if (options?.loopReverse) {
            images = images.concat(images.slice(0, -1).reverse());
        }
        while (this.currentLoop === myLoop && !this.isFaded && (!iterations || loopIndex < iterations)) {
            if (options?.randomize === true) {
                images = shuffleArray(images);
            }
            for (let index = 0; index < images.length; index++) {
                // DEV_LOG && console.log('playing image', index, images[index], this.isFaded, this.currentLoop !== myLoop, images.length);
                if (this.isFaded || this.currentLoop !== myLoop) {
                    break;
                }
                const cleaned = images[index].split('.')[0];
                const imagePath = path.join(imagesFolder, images[index]);
                this.sendImageToDraw(imagePath);
                this.bluetoothHandler.drawImage(imageMap[cleaned], { useCrop });

                await timeout(options?.frameDuration || 200);
            }
            // await this.demoLoop(index, count, loopIndex % 2 === 0);
            loopIndex++;
        }
        this.sendImageToDraw(null);
        await this.fadeout();
    }

    parseLottieFile(data: any) {
        const assets = {};
        data.assets.forEach((a) => {
            assets[a.id] = a.layers;
        });
        const timeline = [];
        let lastOp;
        function addData(data, start = 0, end = 0) {
            // timeline[Math.round(((data.ip + start) * 1000) / 24)] = data.nm;
            const newStart = Math.round(((data.ip + start) * 1000) / 24);
            const last = timeline.length > 1 && timeline[timeline.length - 1];
            if (last && (timeline[timeline.length - 1].time >= newStart || newStart - timeline[timeline.length - 1].time <= 18)) {
                timeline.splice(timeline.length - 1, 1);
            }
            if (!last || last.text !== data.nm) {
                timeline.push({
                    time: Math.round(((data.ip + start) * 1000) / 24),
                    text: data.nm
                });
            }
            if (end) {
                timeline.push({
                    time: Math.round((Math.min(data.op + start, end) * 1000) / 24),
                    text: ''
                });
            } else {
                timeline.push({
                    time: Math.round(((data.op + start) * 1000) / 24),
                    text: ''
                });
            }
        }
        data.layers.forEach((l) => {
            if (assets[l.refId]) {
                assets[l.refId].forEach((d) => addData(d, l.ip, l.op));
            } else {
                addData(l);
            }
        });
        return timeline;
    }

    _setsData: { [k: string]: { imagesMap: { [k: string]: [number, number, number, number, number, string] }; info: { totalImageSize; compress; crop } } } = {};

    storyImageMap(cfgId: string) {
        return this.setData(cfgId).imagesMap;
    }
    get setUsesCrop() {
        return (id) => this.setData(id).info.crop;
    }
    get setData() {
        return (id) => {
            if (!this._setsData[id]) {
                let imagesFolder = getGlassesImagesFolder();
                if (id !== 'navigation') {
                    imagesFolder = path.join(imagesFolder, 'stories');
                }
                DEV_LOG && console.log('setData', id, imagesFolder);
                const imagesMap = JSON.parse(File.fromPath(path.join(imagesFolder, id, 'image_map.json')).readTextSync());
                const info = JSON.parse(File.fromPath(path.join(imagesFolder, id, 'info.json')).readTextSync());
                this._setsData[id] = { imagesMap, info };
            }
            return this._setsData[id];
        };
    }
    get navigationImageMap() {
        return this.setData('navigation').imagesMap;
    }

    async playAudio({ fileName, loop = false, notify = false }: { fileName: string; loop?: boolean; notify?: boolean }) {
        if (!File.exists(fileName)) {
            throw new Error($tc('file_not_found', fileName));
        }
        const file = File.fromPath(fileName);
        DEV_LOG && console.log('playAudio', fileName, loop, file.size);
        return new Promise<void>(async (resolve, reject) => {
            try {
                let resolved = false;
                await this.mPlayer.playFromFile({
                    autoPlay: true,
                    audioFile: fileName,
                    loop,
                    completeCallback: () => {
                        if (!loop && !resolved) {
                            this.notify({ eventName: PlaybackEvent, data: 'stopped' });
                            resolved = true;
                            resolve();
                        }
                    },
                    errorCallback: () => {
                        if (!resolved) {
                            this.notify({ eventName: PlaybackEvent, data: 'stopped' });
                            resolved = true;
                            resolve();
                        }
                    }
                });
                this.notify({ eventName: PlaybackStartEvent, data: this.playingInfo });
                this.notify({ eventName: PlaybackEvent, data: 'play' });
            } catch (error) {
                console.error('playAudio ', error, error.stack);
                reject(error);
            }
        });
    }

    async playAudios(audios: string[], loop = false) {
        for (let index = 0; index < audios.length; index++) {
            await this.playAudio({ fileName: audios[index], loop });
        }
    }
    async playNavigationInstruction(instruction: string, options?: { audioFolder?: string; frameDuration?; randomize?; iterations?; delay?; queue?; force?; noAudio? }) {
        if (instruction === 'exit') {
            instruction = 'uturn';
            options = options || {};
            options.audioFolder = options.audioFolder || path.join(getGlassesImagesFolder(), 'navigation', 'exit');
        }
        return this.playInstruction(instruction, { iterations: 0, frameDuration: 300, instruction: true, queue: false, randomAudio: true, ...options });
    }
    async playInstruction(instruction: string, options: PlayInstructionOptions = {}) {
        if (this.isPlaying) {
            if (options?.force === true) {
                await this.stopPlayingLoop({ fade: false, ignoreNext: true });
            } else if (options?.queue !== false) {
                return new Promise<void>((resolve) => {
                    this.toPlayNext = async () => {
                        await this.playInstruction(instruction, options);
                        resolve();
                    };
                });
            }
            if (options?.noAudio === true && this.isPlayingMusic) {
                // we can still play the instruction
            } else {
                return;
            }
        }

        const instFolder = path.join(getGlassesImagesFolder(), `navigation/${instruction}`);
        TEST_LOG && console.log('playInstruction', instruction, instFolder);
        if (!Folder.exists(instFolder)) {
            return;
        }
        if (instruction) {
            this.isPlayingNavigationInstruction = instruction;
        }
        this.isPlaying = true;
        const files = await Folder.fromPath(instFolder).getEntities();

        const images = files
            .filter((f) => f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.bmp'))
            .map((f) => f.name)
            .sort();

        let audios = [];
        if (options?.noAudio !== true) {
            if (options?.audioFiles) {
                audios = options?.audioFiles;
            } else {
                const audioFiles = options?.audioFolder ? await Folder.fromPath(options?.audioFolder).getEntities() : files;
                audios = audioFiles
                    .filter((f) => f.name.endsWith('.mp3'))
                    .map((f) => f.path)
                    .sort();
            }
        }

        const useCrop = this.setUsesCrop('navigation');
        options.useCrop = useCrop;
        if (audios?.length) {
            if (options?.delay) {
                setTimeout(() => {
                    this.playOfImages(images, instFolder, options);
                }, options?.delay);
            } else {
                this.playOfImages(images, instFolder, options);
            }
            await this.playAudios(options?.randomAudio ? [getRandomFromArray(audios)] : audios, options?.loop);
        } else {
            await this.playOfImages(images, instFolder, options);
        }
        await this.stopPlayingLoop({ instruction: options?.instruction });
        if (instruction) {
            this.isPlayingNavigationInstruction = null;
        }
    }
    lyric: Lyric = null;

    async playRideauAndStory(storyIndex = 1, markAsPlayedOnMap = true) {
        if (!this.canDrawOnGlasses) {
            return;
        }
        TEST_LOG && console.log('playRideauAndStory', storyIndex, this.isPlayingStory, this.isPlaying, this.isPlayingPastille);
        if (this.isPlayingStory === storyIndex) {
            return;
        }
        if (!this.isPlayingPastille && !this.isPlayingStory) {
            await this.stopPlayingLoop({ fade: true });
        }
        // finish what we are playing first
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playRideauAndStory(storyIndex, markAsPlayedOnMap);
                    resolve();
                };
            });
        }
        // console.log('playRideauAndStory', this.isPlaying);
        // set it now to make sure we dont play the same story twice
        this.isPlayingStory = storyIndex;
        // await this.playInstruction('rideau', { iterations: 1 });
        return this.playStory(storyIndex, markAsPlayedOnMap);
    }

    pausedStoryPlayTime = 0;
    async pauseStory() {
        if (this.isPlayingStory || this.isPlayingPastille) {
            this.mPlayer.pause();
            this.lyric?.pause();
            this.isPlayingPaused = true;
            this.pausedStoryPlayTime = this.mPlayer.currentTime;
            DEV_LOG && console.log(TAG, 'pauseStory', this.pausedStoryPlayTime);
            this.notify({ eventName: PlaybackEvent, data: 'pause' });
        }
    }
    async resumeStory() {
        if ((this.isPlayingStory || this.isPlayingPastille) && this.isPlayingPaused) {
            this.mPlayer.resume();
            this.lyric?.play(this.pausedStoryPlayTime);
            this.isPlayingPaused = false;
            DEV_LOG && console.log(TAG, 'resumeStory', this.pausedStoryPlayTime);
            this.pausedStoryPlayTime = 0;
            this.notify({ eventName: PlaybackEvent, data: 'play' });
        }
    }
    async setPlayerTimestamp(playTime: number) {
        DEV_LOG && console.log(TAG, 'setStoryTimestamp', playTime, this.isPlayingStory, this.isPlayingPaused);
        if (this.isPlayingStory) {
            this.mPlayer.seekTo(playTime / 1000);
            if (this.isPlayingPaused) {
                this.pausedStoryPlayTime = playTime;
            } else {
                this.lyric?.play(playTime);
            }
        }
    }
    async playStory(index = 1, shouldPlayStop = true, canStopStoryPlayback = false, markAsPlayedOnMap = true) {
        if (!this.canDrawOnGlasses) {
            return;
        }
        TEST_LOG && console.log('playStory', index, this.isPlaying, shouldPlayStop);
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playStory(index, shouldPlayStop, canStopStoryPlayback, markAsPlayedOnMap);
                    resolve();
                };
            });
        }
        try {
            const bluetoothHandler = this.bluetoothHandler;
            if (markAsPlayedOnMap && this.isStoryPlayed(index)) {
                TEST_LOG && console.error('trying to play already played story', index, new Error().stack);
                return;
            }
            const cfgId = index + '';
            const storyFolder = path.join(getGlassesImagesFolder(), 'stories', cfgId);
            TEST_LOG && console.log('storyFolder', storyFolder, Folder.exists(storyFolder));
            if (!Folder.exists(storyFolder)) {
                return;
            }
            this.isPlaying = true;
            this.isPlayingStory = index;
            this.canStopStoryPlayback = canStopStoryPlayback;
            const data = await File.fromPath(path.join(storyFolder, 'composition.json')).readText();
            const imagesMap = this.storyImageMap(cfgId);
            const result = this.parseLottieFile(JSON.parse(data));
            if (bluetoothHandler.glasses) {
                bluetoothHandler.setConfig(cfgId);
                bluetoothHandler.sendDim(100);
            }
            if (this.lyric) {
                this.lyric.pause();
            }
            const navImages = this.navigationImageMap;
            let lastImageWasNav = false;
            const navUseCrop = this.setUsesCrop('navigation');
            const storyUseCrop = this.setUsesCrop(cfgId);
            this.lyric = new Lyric({
                lines: [{ time: 0, text: '' }].concat(result),
                onPlay: async (line, text) => {
                    if (text && text.length > 0) {
                        const commands: { commandType: CommandType; params?: InputCommandType<any> }[] = [];

                        const cleaned = text.split('.')[0];
                        // console.log('onPlay', cleaned, navImages[cleaned], navUseCrop, imagesMap[cleaned], storyUseCrop);
                        if (navImages[cleaned]) {
                            if (!lastImageWasNav) {
                                commands.push({
                                    commandType: CommandType.cfgSet,
                                    params: { name: 'nav' }
                                });
                            }
                            if (navUseCrop) {
                                commands.push(
                                    {
                                        commandType: CommandType.HoldFlushw,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Color,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Rectf,
                                        params: FULLSCREEN
                                    }
                                );
                            }
                            lastImageWasNav = true;
                            const data = navImages[cleaned];
                            commands.push({
                                commandType: CommandType.imgDisplay,
                                params: data.slice(0, 3)
                            });
                            if (navUseCrop) {
                                commands.push({
                                    commandType: CommandType.HoldFlushw,
                                    params: [1]
                                });
                            }
                            bluetoothHandler.sendCommands(commands);
                            const instFolder = path.join(getGlassesImagesFolder(), `navigation/${data[5]}`);
                            //TODO: upgrade images res and use jpg
                            this.sendImageToDraw(path.join(instFolder, cleaned + '.jpg'));
                        } else if (imagesMap[cleaned]) {
                            if (lastImageWasNav) {
                                commands.push({
                                    commandType: CommandType.cfgSet,
                                    params: { name: cfgId }
                                });
                            }
                            lastImageWasNav = false;
                            // const [imageId, x, y] = imagesMap[cleaned];
                            // this.clearFadeout();
                            // this.sendBitmap(imageId, x, y);
                            if (storyUseCrop) {
                                commands.push(
                                    {
                                        commandType: CommandType.HoldFlushw,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Color,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Rectf,
                                        params: FULLSCREEN
                                    }
                                );
                            }
                            commands.push({
                                commandType: CommandType.imgDisplay,
                                params: imagesMap[cleaned]
                            });
                            if (storyUseCrop) {
                                commands.push({
                                    commandType: CommandType.HoldFlushw,
                                    params: [1]
                                });
                            }
                            bluetoothHandler.sendCommands(commands);
                            this.sendImageToDraw(path.join(storyFolder, 'images', cleaned + '.jpg'));
                        } else {
                            console.error('image missing', text, cleaned);
                        }
                    } else {
                        this.sendImageToDraw(null);
                        bluetoothHandler.clearScreen();
                    }
                }
            });
            this.clearFadeout();

            this.lyric.play();
            // this.notify({ eventName: PlaybackEvent, data: 'play' });
            await this.playAudio({ fileName: path.join(storyFolder, 'audio.mp3'), notify: true });
            TEST_LOG && console.log('playStory done ', index, this.isPlaying);
            // mark story as played

            this.playedStory(index + '', markAsPlayedOnMap);
            this.notify({ eventName: PlaybackEvent, data: 'stopped' });
            if (shouldPlayStop && this.geoHandler.sessionState !== SessionState.STOPPED) {
                let audioFiles;
                if (ApplicationSettings.getBoolean('perStoryMessages', true)) {
                    const endingStoryAudio = path.join(storyFolder, 'ending.mp3');
                    if (File.exists(endingStoryAudio)) {
                        audioFiles = [endingStoryAudio];
                    }
                }
                if (PRODUCTION) {
                    this.playInstruction('story_finished', { audioFiles });
                }
            }
        } catch (err) {
            throw err;
        } finally {
            DEV_LOG && console.log('finished playing story');
            if (this.isPlayingStory === index) {
                this.pausedStoryPlayTime = 0;
                this.canStopStoryPlayback = false;
                this.stopPlayingLoop();
            }
        }
    }

    drawImageFromPath(filePath: string, send = true) {
        const navImages = this.navigationImageMap;
        const commands: Command[] = [];
        const splitted = filePath.split('/');
        const fileName = splitted[splitted.length - 1];
        const cleaned = fileName.split('.').slice(0, -1).join('.');
        // console.log('drawImageFromPath', filePath, fileName, cleaned, navImages[cleaned]);
        let useCrop = false;
        let data = navImages[cleaned];
        let cfgId;
        if (data) {
            useCrop = this.setUsesCrop('navigation');
            cfgId = 'nav';
        } else {
            cfgId = splitted[splitted.length - 3];
            data = this.storyImageMap(cfgId)[cleaned];
        }
        DEV_LOG && console.log('drawImageFromPath', filePath, cfgId, data);
        if (useCrop) {
            commands.push(
                {
                    commandType: CommandType.HoldFlushw,
                    params: [0]
                },
                {
                    commandType: CommandType.Color,
                    params: [0]
                },
                {
                    commandType: CommandType.Rectf,
                    params: FULLSCREEN
                }
            );
        }
        commands.push({
            commandType: CommandType.cfgSet,
            params: { name: cfgId }
        });
        commands.push({
            commandType: CommandType.imgDisplay,
            params: data.slice(0, 3)
        });
        if (useCrop) {
            commands.push({
                commandType: CommandType.HoldFlushw,
                params: [1]
            });
        }
        if (send) {
            this.bluetoothHandler.sendCommands(commands);
        } else {
            return commands;
        }
    }
    drawImageFromPathWithMire(filePath: string) {
        const commands = this.drawImageFromPath(filePath, false);
        commands.unshift({ commandType: CommandType.Clear });
        commands.push(
            {
                commandType: CommandType.Color,
                params: [15]
            },
            {
                commandType: CommandType.Point,
                params: [1, 1]
            },
            {
                commandType: CommandType.Point,
                params: [243, 1]
            },
            {
                commandType: CommandType.Point,
                params: [243, 205]
            },
            {
                commandType: CommandType.Point,
                params: [1, 205]
            }
        );
        this.bluetoothHandler.sendCommands(commands);
    }

    sendConfigPromise: CancelPromise = null;
    canDrawOnGlasses: boolean = true;
    async sendConfigToGlasses(config: string, memory: FreeSpaceData, onStart?: (promise: CancelPromise) => void, onProgress?: (progress, current, total) => void) {
        const bluetoothHandler = this.bluetoothHandler;
        let progressNotificationId;
        try {
            progressNotificationId = 52347 + hashCode(config);
            if (this.sendConfigPromise) {
                throw new Error('sending_config');
            }
            this.canDrawOnGlasses = false;
            const startTime = Date.now();
            const configId = config.split('/').pop();
            await new Promise<void>(async (resolve, reject) => {
                let onGlassesDisconnected: (data: EventData) => void;
                try {
                    let size;
                    try {
                        size = JSON.parse(File.fromPath(path.join(config, 'info.json')).readTextSync()).totalImageSize;
                    } catch (error) {
                        console.error('get totalImageSize', error, error.stack);
                        size = File.fromPath(path.join(config, 'images.txt')).size / 2;
                    }
                    DEV_LOG && console.log('sendConfigToGlasses', configId, size, memory.freeSpace);
                    if (size >= memory.freeSpace) {
                        throw new MessageError({ message: $tc('not_enough_memory', size, memory.freeSpace) });
                    }
                    const progressNotification = ProgressNotification.show({
                        id: progressNotificationId, //required
                        icon: configId[0],
                        smallIcon: 'mdi-upload',
                        title: $tc('uploading_story'),
                        notifTitle: $tc('uploading_story_to_glasses', configId),
                        message: `${filesize(size, { round: 1, pad: true })}`,
                        ongoing: true,
                        indeterminate: false,
                        progress: 0,
                        actions: [
                            {
                                id: 'cancel',
                                text: 'mdi-close',
                                notifText: $tc('cancel'),
                                callback: () => {
                                    if (this.sendConfigPromise) {
                                        DEV_LOG && console.log('cancelling sending config', configId);
                                        //if we cancel we need to delete the config to ensure we are good
                                        this.sendConfigPromise.cancel();
                                        //we need to delete the broken config on reboot
                                        bluetoothHandler.once(GlassesReadyEvent, () => {
                                            bluetoothHandler.deleteConfig(configId);
                                        });
                                        //we need to reboot the glasses in this case :s
                                        bluetoothHandler.rebootGlasses();
                                    }
                                }
                            }
                        ]
                    });
                    onGlassesDisconnected = () => {
                        DEV_LOG && console.log(TAG, 'sendConfigToGlasses', 'onGlassesDisconnected');
                        this.sendConfigPromise?.cancel();
                        this.sendConfigPromise = null;
                    };
                    this.on(GlassesDisconnectedEvent, onGlassesDisconnected);
                    const onInnerProgress = throttle((progress, current, total) => {
                        const perc = Math.round((current / total) * 100);
                        ProgressNotification.update(progressNotification, {
                            rightIcon: `${perc}%`,
                            progress: perc
                        });
                    }, 2000);
                    this.sendConfigPromise = bluetoothHandler.sendLayoutConfig(path.join(config, 'images.txt'), (progress, current, total) => {
                        onProgress?.(progress, current, total);
                        onInnerProgress(progress, current, total);
                        if (progress === 1) {
                            resolve();
                        }
                    });
                    onStart?.(this.sendConfigPromise);
                    await this.sendConfigPromise;
                } catch (error) {
                    reject(error);
                } finally {
                    this.off(GlassesDisconnectedEvent, onGlassesDisconnected);
                }
            });
            const duration = formatDuration(dayjs.duration(Date.now() - startTime), DURATION_FORMAT.SECONDS);
            DEV_LOG && console.log('sendConfigToGlasses done ', config, Date.now() - startTime, duration);
            showSnack({
                message: $tc('story_sent_glasses', configId, duration)
            });
        } catch (error) {
            throw error;
        } finally {
            DEV_LOG && console.log('finished sending config', config);
            this.canDrawOnGlasses = true;
            this.sendConfigPromise = null;
            ProgressNotification.dismiss(progressNotificationId);
            bluetoothHandler.askConfigs();
            if (this.toPlayNext) {
                this.toPlayNext();
            }
        }
    }
}
