import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, off as applicationOff, on as applicationOn, exitEvent, launchEvent } from '@nativescript/core/application';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { DBHandler } from '~/handlers/DBHandler';
import { StoryHandler } from '~/handlers/StoryHandler';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';

const TAG = '[BgServiceCommon]';
export abstract class BgServiceCommon extends Observable {
    abstract get geoHandler(): GeoHandler;
    abstract get bluetoothHandler(): BluetoothHandler;
    abstract get dbHandler(): DBHandler;
    abstract get storyHandler(): StoryHandler;
    protected _loaded = false;
    protected _started = false;

    constructor() {
        super();
        applicationOn(exitEvent, this.onAppExit, this);
        applicationOn(launchEvent, this.onAppLaunch, this);
    }
    get loaded() {
        return this._loaded;
    }
    get started() {
        return this._started;
    }
    protected _handlerLoaded() {
        if (!this._loaded) {
            this._loaded = true;
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }
    async stop() {
        if (!this._started) {
            return;
        }
        DEV_LOG && console.log(TAG, 'stop');
        this._started = false;
        await Promise.all([this.dbHandler.stop(), this.geoHandler.stop(), this.bluetoothHandler.stop(), this.storyHandler.stop()]);
        DEV_LOG && console.log(TAG, 'stopped');
    }
    async start() {
        if (this._started) {
            return;
        }
        DEV_LOG && console.log(TAG, ' start');
        await this.dbHandler.start();
        await Promise.all([this.geoHandler.start(), this.bluetoothHandler.start(), this.storyHandler.start()]);
        this._started = true;
        DEV_LOG && console.log(TAG, 'started');
        this.notify({
            eventName: BgServiceStartedEvent,
            object: this
        });
    }
    onAppLaunch(args: ApplicationEventData) {
        DEV_LOG && console.log(TAG, 'onAppLaunch');
        try {
            this.start();
        } catch (error) {
            console.error('error starting BGService', error);
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
    onAppExit(args: ApplicationEventData) {
        DEV_LOG && console.log(TAG, 'onAppExit');

        try {
            this.stop();
        } catch (error) {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        }
    }
}
