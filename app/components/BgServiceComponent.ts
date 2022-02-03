import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
import { ApplicationEventData, off as applicationOff, on as applicationOn } from '@nativescript/core/application';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { DBHandler } from '~/handlers/DBHandler';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BgServiceLoadedEvent } from '~/services/BgService';
import { BgServiceStartedEvent } from '~/services/BgService.common';
import BaseVueComponent from './BaseVueComponent';

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
        applicationOn(backgroundEvent, this.onAppPause, this);
        applicationOn(foregroundEvent, this.onAppResume, this);
    }
    destroyed() {
        super.destroyed();

        applicationOff(backgroundEvent, this.onAppPause, this);
        applicationOff(foregroundEvent, this.onAppResume, this);
        this.unloadService();
    }

    inSetup = false;
    onAppResume(args: ApplicationEventData) {
        DEV_LOG && console.log('onAppResume', this.appPaused);
        if (!this.appPaused) {
            return;
        }
        this.appPaused = false;
        if (this.setup && this.$bgService.loaded) {
            this.inSetup = true;
            const params = this.getParams();
            this.setup.call(this, params);
            this.inSetup = false;
        }
    }
    onAppPause(args: ApplicationEventData) {
        DEV_LOG && console.log('onAppPause', this.appPaused);
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
            this.unregisterSetupEvents();
        }
    }
    /**
     * The point of that method is to register data only while app is in front (ui showing)
     * they will get disabled when the app is paused
     * @param geoHandler
     */
    setup?(handlers: BgServiceMethodParams);
    unsetup?(handlers: BgServiceMethodParams);

    callOnServiceLoaded() {
        const params = this.getParams();
        // if (this.setup && !this.appPaused) {
        //     this.setup.call(this, params);
        // }
        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceLoaded.call(this, params);
    }
    callOnServiceStarted() {
        const params = this.getParams();
        console.log('callOnServiceStarted', this.constructor.name);

        if (this.setup && !this.appPaused) {
            this.inSetup = true;
            this.setup.call(this, params);
            this.inSetup = false;
        }

        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceStarted.call(this, params);
    }
    unregisterSetupEvents() {
        DEV_LOG && console.log('unregisterSetupEvents');
        const bluetoothHandler = this.$bgService.bluetoothHandler;
        const geoHandler = this.$bgService.geoHandler;
        if (bluetoothHandler) {
            this.bluetoothHandlerSetupListeners.forEach((r) => {
                bluetoothHandler.off(r[0], r[1], r[2] || this);
            });
        }
        this.bluetoothHandlerSetupListeners = [];
        if (geoHandler) {
            this.geoHandlerSetupListeners.forEach((r) => {
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.geoHandlerSetupListeners = [];
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
                DEV_LOG && console.log('unregisterEvents', r[0]);
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.geoHandlerListeners = [];
    }
    unloadService() {
        this.unregisterSetupEvents();
        this.unregisterEvents();
        this.onServiceUnloaded.call(this, this.getParams());
    }

    getParams() {
        const geoHandler = this.geoHandler;
        const dbHandler = this.dbHandler;
        const bluetoothHandler = this.bluetoothHandler;
        return { geoHandler, dbHandler, bluetoothHandler };
    }

    bluetoothHandlerSetupListeners: any[] = [];
    bluetoothHandlerListeners: any[] = [];
    bluetoothHandlerOn(event, listener, context = this) {
        if (this.inSetup) {
            this.bluetoothHandlerSetupListeners.push([event, listener]);
        } else {
            this.bluetoothHandlerListeners.push([event, listener]);
        }
        this.bluetoothHandler.on(event, listener, context);
        return this;
    }
    geoHandlerSetupListeners: any[] = [];
    geoHandlerListeners: any[] = [];
    geoHandlerOn(event, listener, context = this) {
        if (this.inSetup) {
            this.geoHandlerSetupListeners.push([event, listener]);
        } else {
            this.geoHandlerListeners.push([event, listener]);
        }
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
