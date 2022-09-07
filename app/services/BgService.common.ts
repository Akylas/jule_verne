import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, off as applicationOff, on as applicationOn, exitEvent, launchEvent } from '@nativescript/core/application';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';

const TAG = '[BgServiceCommon]';
export abstract class BgServiceCommon extends Observable {
    abstract get geoHandler(): GeoHandler;
    abstract get bluetoothHandler(): BluetoothHandler;
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
        this.geoHandler.bluetoothHandler = this.bluetoothHandler;
        this.bluetoothHandler.geoHandler = this.geoHandler;
        if (!this._loaded) {
            this._loaded = true;
            this.notify({
                eventName: BgServiceLoadedEvent,
                object: this
            });
        }
    }
    async stop() {
        DEV_LOG && console.log(TAG, 'stop');
        this._started = false;
        await Promise.all([this.geoHandler.stop(), this.bluetoothHandler.stop()]);
        DEV_LOG && console.log(TAG, 'stopped');
    }
    async start() {
        DEV_LOG && console.log(TAG, ' start');
        await  Promise.all([this.geoHandler.start(), this.bluetoothHandler.start()])
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
