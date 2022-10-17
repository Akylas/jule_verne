import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
import { GPS, GenericGeoLocation, Options as GeolocationOptions, LocationMonitor, setGeoLocationKeys, setMockEnabled } from '@nativescript-community/gps';
import * as perms from '@nativescript-community/perms';
import { CoreTypes, Device } from '@nativescript/core';
import { AndroidActivityResultEventData, AndroidApplication, ApplicationEventData, android as androidApp, off as applicationOff, on as applicationOn } from '@nativescript/core/application';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { bind } from 'helpful-decorators';
import { $t, $tc } from '~/helpers/locale';
import { BgServiceCommon } from '~/services/BgService.common';
import { permResultCheck } from '~/utils';
import { confirm } from '~/utils/dialogs';
import { Handler } from './Handler';

setGeoLocationKeys('lat', 'lon', 'altitude');
const sdkVersion = parseInt(Device.sdkVersion, 10);

export type GeoLocation = GenericGeoLocation<LatLonKeys> & {
    computedBearing?: number;
};

let geolocation: GPS;

//@ts-ignore
export const desiredAccuracy = __ANDROID__ ? CoreTypes.Accuracy.high : kCLLocationAccuracyBestForNavigation;
export const gpsTimeout = 20000;
export const minimumUpdateTime = 1000; // Should update every 1 second according ;

setMockEnabled(true);

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

const TAG = '[Geo]';

export interface GPSEvent extends EventData {
    data?: any;
    location?: GeoLocation;
    error?: Error;
}

export interface SessionEventData extends GPSEvent {
    data: {
        state: SessionState;
        oldState: SessionState;
    };
}

export interface SessionChronoEventData extends GPSEvent {
    data: number; // chrono
}

export class GeoHandler extends Handler {
    watchId;
    _isIOSBackgroundMode = false;
    _deferringUpdates = false;

    sessionState: SessionState = SessionState.STOPPED;
    // lastLocation?: GeoLocation;
    gpsEnabled = true;

    launched = false;

    isSessionPaused() {
        return this.sessionState === SessionState.PAUSED;
    }

    setSessionState(state: SessionState) {
        if (this.sessionState === state) {
            return;
        }
        const oldState = this.sessionState;
        DEV_LOG && console.log('setSessionState', oldState, state);
        this.sessionState = state;
        this.notify({
            eventName: SessionStateEvent,
            object: this,
            data: {
                oldState,
                state
            }
        } as SessionEventData);
    }
    actualSessionStart(createSession = false) {
        DEV_LOG && console.log('actualSessionStart', this.sessionState);
        this.setSessionState(SessionState.RUNNING);
        this.startWatch();
    }
    actualSessionStop(finish = false) {
        this.setSessionState(finish ? SessionState.STOPPED : SessionState.PAUSED);
        this.stopWatch();
    }

    constructor(service: BgServiceCommon) {
        super(service);
        DEV_LOG && console.log(TAG, 'creating GPS Handler', !!geolocation, DEV_LOG);
        if (!geolocation) {
            geolocation = new GPS();
        }
    }

    async stop() {
        DEV_LOG && console.log(TAG, 'stop');
        await this.stopSession();
        this.launched = false;
        geolocation.off(GPS.gps_status_event, this.onGPSStateChange, this);
        applicationOff(backgroundEvent, this.onAppBackgrounded, this);
        applicationOff(foregroundEvent, this.onAppForgrounded, this);
        DEV_LOG && console.log(TAG, 'stop done');
    }
    async start() {
        this.launched = true;
        geolocation.on(GPS.gps_status_event, this.onGPSStateChange, this);

        const gpsEnabled = await this.checkLocationPerm();
        // set to true if not allowed yet for the UI
        this.gpsEnabled = !gpsEnabled ? false : geolocation.isEnabled();
        applicationOn(backgroundEvent, this.onAppBackgrounded, this);
        applicationOn(foregroundEvent, this.onAppForgrounded, this);
    }

    onAppForgrounded(args: ApplicationEventData) {
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
    onAppBackgrounded(args: ApplicationEventData) {
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
        TEST_LOG && console.log(TAG, 'GPS state change', enabled);
        // if (!enabled) {
        //     this.stopSession();
        // }
        this.notify({
            eventName: GPSStatusChangedEvent,
            object: this,
            data: enabled
        });
    }

    async checkIfEnabled() {
        if (!this.gpsEnabled) {
            const r = await confirm({
                message: $tc('gps_not_enabled'),
                okButtonText: $t('settings'),
                cancelButtonText: $t('cancel')
            });
            if (__ANDROID__ && !!r) {
                await this.openGPSSettings();
            }
        }
    }
    async checkAndAuthorize(always = false) {
        const r = await this.checkLocationPerm();
        if (!r) {
            return this.authorizeLocation(always);
        }
    }
    async openGPSSettings() {
        TEST_LOG && console.log('openGPSSettings');
        return geolocation.openGPSSettings();
    }
    permResultCheck(r) {
        if (Array.isArray(r)) {
            return r[0] === 'authorized';
        } else {
            const unauthorized = Object.keys(r).some((s) => r[s] !== 'authorized');
            return !unauthorized;
        }
    }
    async checkLocationPerm(always = false) {
        const r = await perms.check('location', { type: always ? 'always' : undefined });
        return permResultCheck(r);
    }
    async authorizeLocation(always = false) {
        const r = await perms.request('location', { type: always ? 'always' : undefined });
        if (!this.permResultCheck(r)) {
            throw new Error('gps_denied');
        }
        this.gpsEnabled = geolocation.isEnabled();
        return r;
    }
    askToEnableIfNotEnabled() {
        if (geolocation.isEnabled()) {
            return Promise.resolve(true);
        } else {
            // return confirm({
            //     message: $tc('gps_not_enabled'),
            //     okButtonText: $t('settings'),
            //     cancelButtonText: $t('cancel')
            // }).then((result) => {
            //     if (!!result) {
            //         return geolocation.openGPSSettings();
            //     }
            return Promise.reject();
            // });
        }
    }
    async checkAuthorizedAndEnabled(always = false) {
        await this.checkAndAuthorize(always);
        return this.checkIfEnabled();
    }

    enableLocation() {
        return this.checkAuthorizedAndEnabled();
    }

    isBatteryOptimized(context: android.content.Context) {
        const pwrm = context.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager;
        const name = context.getPackageName();
        if (sdkVersion >= 23) {
            return !pwrm.isIgnoringBatteryOptimizations(name);
        }
        return false;
    }
    async checkBattery() {
        if (__IOS__) {
            return;
        }
        const activity = androidApp.foregroundActivity || androidApp.startActivity;
        if (this.isBatteryOptimized(activity) && sdkVersion >= 22) {
            await new Promise<void>((resolve) => {
                const REQUEST_CODE = 6645;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve();
                    }
                };
                androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(android.net.Uri.parse('package:' + __APP_ID__));
                activity.startActivityForResult(intent, REQUEST_CODE);
            });
        }
    }

    isMiui() {
        return /Xiaomi/i.test(Device.manufacturer);
    }
    openMIUIBatterySaver() {
        if (this.isMiui()) {
            try {
                const activity = androidApp.foregroundActivity || androidApp.startActivity;

                const intent = new android.content.Intent();
                intent.setComponent(new android.content.ComponentName('com.miui.powerkeeper', 'com.miui.powerkeeper.ui.HiddenAppsConfigActivity'));
                intent.putExtra('package_name', __APP_ID__);
                intent.putExtra('package_label', $t('app.name'));
                activity.startActivity(intent);
            } catch (error) {
                console.error('openMIUIBatterySaver', error, error.stack);
            }
        }
    }
    getLastKnownLocation(): GeoLocation {
        return LocationMonitor.getLastKnownLocation<LatLonKeys>();
    }
    getLocation(options?) {
        return geolocation
            .getCurrentLocation<LatLonKeys>(options || { desiredAccuracy, timeout: gpsTimeout, onDeferred: this.onDeferred, skipPermissionCheck: true })
            .then((r) => {
                DEV_LOG && console.log(TAG, 'getLocation', r);
                if (r) {
                    this.notify({
                        eventName: UserRawLocationEvent,
                        object: this,
                        location: r
                    } as GPSEvent);
                }

                return r;
            })
            .catch((err) => {
                this.notify({
                    eventName: UserRawLocationEvent,
                    object: this,
                    error: err
                } as GPSEvent);
                return Promise.reject(err);
            });
    }

    @bind
    onDeferred() {
        this._deferringUpdates = false;
    }
    // async speakText(text: string) {
    //     if (this.isSpeaking) {
    //         this.speakQueue.push(text);
    //         return;
    //     }
    //     this.isSpeaking = true;
    //     try {
    //         await TTS.speak({
    //             text,
    //             finishedCallback: () => {
    //                 this.isSpeaking = false;
    //                 if (this.speakQueue.length > 0) {
    //                     this.speakText(this.speakQueue.shift());
    //                 }
    //             }
    //         });
    //     } catch (err) {
    //         this.isSpeaking = false;
    //     }
    // }
    mOnLocationAugmenters = [];
    addOnLocationAugmenter(f) {
        this.mOnLocationAugmenters.push(f);
    }
    removeOnLocationAugmenter(f) {
        const index = this.mOnLocationAugmenters.indexOf(f);
        if (index !== -1) {
            this.mOnLocationAugmenters.splice(index, 1);
        }
    }
    @bind
    onLocation(loc: GeoLocation, manager?: any) {
        try {
            const { android, ios, ...toLog } = loc;
            const args = {
                eventName: UserRawLocationEvent,
                object: this,
                location: loc
            } as GPSEvent;

            // ensure we update before notifying
            this.mOnLocationAugmenters.forEach((f) => f(args));

            this.notify(args);
        } catch (error) {
            console.error(TAG, 'onLocation', error, error.stack);
            const args = {
                eventName: UserRawLocationEvent,
                object: this,
                error
            } as GPSEvent;
            this.notify(args);
        }
        if (manager && this._isIOSBackgroundMode && !this._deferringUpdates) {
            this._deferringUpdates = true;
            manager.allowDeferredLocationUpdatesUntilTraveledTimeout(0, 10);
        }
    }
    @bind
    onLocationError(err: Error) {
        TEST_LOG && console.log(TAG, ' location error: ', err);
        this.notify({
            eventName: UserRawLocationEvent,
            object: this,
            error: err
        } as GPSEvent);
    }
    startWatch() {
        if (this.watchId) {
            this.stopWatch();
        }
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
        TEST_LOG && console.log(TAG, 'startWatch', options);

        return geolocation.watchLocation<LatLonKeys>(this.onLocation, this.onLocationError, options).then((id) => (this.watchId = id));
    }

    stopWatch() {
        TEST_LOG && console.log(TAG, 'stopWatch', this.watchId);
        if (this.watchId) {
            geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    isWatching() {
        return !!this.watchId;
    }

    async stopSession(finish = true) {
        TEST_LOG && console.log(TAG, 'stopSession', this.sessionState, finish);
        if (this.sessionState === SessionState.STOPPED) {
            return false;
        }
        this.actualSessionStop(finish);
        return true;
    }
    async pauseSession() {
        this.setSessionState(SessionState.PAUSED);
        // this.actualSessionStop();
    }
    async askForSessionPerms() {
        await this.enableLocation();
        await this.checkBattery();
    }

    async askAndStartSession() {
        await this.askForSessionPerms();
        return this.startSession();
    }
    async startSession() {
        TEST_LOG && console.log(TAG, 'startSession', this.sessionState);
        if (this.sessionState === SessionState.STOPPED) {
            this.actualSessionStart(true);
        }
    }

    async resumeSession() {
        if (this.sessionState === SessionState.PAUSED) {
            this.setSessionState(SessionState.RUNNING);
            // await this.enableLocation();
            // this.actualSessionStart();
        }
    }
}
