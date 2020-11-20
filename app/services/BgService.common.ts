import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { ApplicationEventData, off as applicationOff, on as applicationOn, exitEvent, launchEvent } from '@nativescript/core/application';

export const BgServiceLoadedEvent = 'BgServiceLoadedEvent';
export const BgServiceStartedEvent = 'BgServiceStartedEvent';
export const BgServiceErrorEvent = 'BgServiceErrorEvent';
export abstract class BgServiceCommon extends Observable {
    abstract get  geoHandler(): GeoHandler;
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
    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }

    stop() {
        this.log('stop');
        this._started = false;
        return Promise.all([this.geoHandler.stop()]) as Promise<any>;
    }
    start() {
        this.log(' start');
        return Promise.all([this.geoHandler.start()]).then(() => {
            this._started = true;
            this.log('started');
            this.notify({
                eventName: BgServiceStartedEvent,
                object: this
            });
        });
    }
    onAppLaunch(args: ApplicationEventData) {
        // this.log('onAppLaunch');
        this.start().catch(error => {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        });
    }
    onAppExit(args: ApplicationEventData) {
        this.stop().catch(error => {
            this.notify({
                eventName: BgServiceErrorEvent,
                object: this,
                error
            });
        });
    }
}
