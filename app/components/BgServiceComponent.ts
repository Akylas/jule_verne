import { BgServiceLoadedEvent } from '~/services/BgService';
import { GeoHandler } from '~/handlers/GeoHandler';
import BaseVueComponent from './BaseVueComponent';
import { ApplicationEventData, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
import { BgServiceStartedEvent } from '~/services/BgService.common';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { DBHandler } from '~/handlers/DBHandler';

export interface BgServiceMethodParams {
    bluetoothHandler: BluetoothHandler;
    geoHandler: GeoHandler;
    dbHandler: DBHandler;
}

export default abstract class BgServiceComponent extends BaseVueComponent {
    appPaused = false;
    mounted() {
        super.mounted();
        if (this.$bgService.loaded) {
            this.callOnServiceLoaded();
        } else {
            this.$bgService.once(BgServiceLoadedEvent, this.callOnServiceLoaded, this);
        }
        if (this.$bgService.started) {
            this.callOnServiceStarted();
        } else {
            this.$bgService.once(BgServiceStartedEvent, this.callOnServiceStarted, this);
        }
        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);
    }
    destroyed() {
        super.destroyed();

        applicationOff(suspendEvent, this.onAppPause, this);
        applicationOff(resumeEvent, this.onAppResume, this);
        this.unloadService();
    }

    onAppResume(args: ApplicationEventData) {
        if (!this.appPaused) {
            return;
        }
        this.appPaused = false;
        if (this.setup && this.$bgService.loaded) {
            const params = this.getParams();
            this.setup.call(this, params);
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (this.appPaused) {
            return;
        }
        this.appPaused = true;
        if (this.unsetup) {
            const params = this.getParams();
            this.unsetup.call(this, params);
        }
        // if setup is used we unregister all registered events to prevent trying to
        // update ui while the app is in background
        if (this.setup) {
            this.unregisterEvents();
        }
    }
    /**
     * The point of that method is to register data only while app is in front (ui showing)
     * they will get disabled when the app is paused
     * @param geoHandler
     */
    setup?(handlers: BgServiceMethodParams);
    unsetup?(handlers: BgServiceMethodParams);

    onImperialUnitChanged?(value: boolean);
    callOnServiceLoaded() {
        const params = this.getParams();
        if (this.setup && !this.appPaused) {
            this.setup.call(this, params);
        }
        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceLoaded.call(this, params);
    }
    callOnServiceStarted() {
        const params = this.getParams();

        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceStarted.call(this, params);
    }
    unregisterEvents() {
        const bluetoothHandler = this.$bgService.bluetoothHandler;
        const geoHandler = this.$bgService.geoHandler;
        if (bluetoothHandler) {
            this.bluetoothHandlerListeners.forEach((r) => {
                bluetoothHandler.off(r[0], r[1], r[2] || this);
            });
        }
        this.bluetoothHandlerListeners = [];
        if (geoHandler) {
            this.geoHandlerListeners.forEach((r) => {
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.geoHandlerListeners = [];
    }
    unloadService() {
        this.unregisterEvents();
        this.onServiceUnloaded.call(this, this.getParams());
    }

    getParams() {
        const geoHandler = this.geoHandler;
        const dbHandler = this.dbHandler;
        const bluetoothHandler = this.geoHandler;
        return { geoHandler, dbHandler, bluetoothHandler };
    }

    bluetoothHandlerListeners: any[] = [];
    bluetoothHandlerOn(event, listener, context = this) {
        this.bluetoothHandlerListeners.push([event, listener]);
        this.bluetoothHandler.on(event, listener, context);
        return this;
    }
    geoHandlerListeners: any[] = [];
    geoHandlerOn(event, listener, context = this) {
        this.geoHandlerListeners.push([event, listener]);
        this.geoHandler.on(event, listener, context);
        return this;
    }

    get geoHandler() {
        return this.$bgService && this.$bgService.geoHandler;
    }
    get dbHandler() {
        return this.$bgService && this.$bgService.geoHandler && this.$bgService.geoHandler.dbHandler;
    }
    get bluetoothHandler() {
        return this.$bgService && this.$bgService.bluetoothHandler && this.$bgService.bluetoothHandler;
    }
    onServiceLoaded(handlers: BgServiceMethodParams) {}
    onServiceStarted(handlers: BgServiceMethodParams) {}
    onServiceUnloaded(handlers: BgServiceMethodParams) {}
}
