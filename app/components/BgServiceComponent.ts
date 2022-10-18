import { ApplicationEventData, off as applicationOff, on as applicationOn, backgroundEvent, foregroundEvent } from '@nativescript/core/application';
import { inBackground } from '@akylas/nativescript/application/application-common';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { DBHandler } from '~/handlers/DBHandler';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BgServiceLoadedEvent } from '~/services/BgService';
import { BgServiceStartedEvent } from '~/services/BgService.common';
import BaseVueComponent from './BaseVueComponent';
import { StoryHandler } from '~/handlers/StoryHandler';

export interface BgServiceMethodParams {
    bluetoothHandler: BluetoothHandler;
    geoHandler: GeoHandler;
    dbHandler: DBHandler;
    storyHandler: StoryHandler;
}

const TAG = '[BgServiceComponent]';

export default abstract class BgServiceComponent extends BaseVueComponent {
    backgrounded = false;
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
        this.backgrounded = inBackground;
        applicationOn(backgroundEvent, this.onAppBackgrounded, this);
        applicationOn(foregroundEvent, this.onAppForgrounded, this);
    }
    destroyed() {
        super.destroyed();
        applicationOff(backgroundEvent, this.onAppBackgrounded, this);
        applicationOff(foregroundEvent, this.onAppForgrounded, this);
        this.unloadService();
    }

    inSetup = false;
    onAppForgrounded(args: ApplicationEventData) {
        // DEV_LOG && console.log(TAG, this.constructor.name, 'onAppForgrounded', this.backgrounded);
        if (!this.backgrounded) {
            return;
        }
        this.backgrounded = false;
        // DEV_LOG && console.log('onAppForgrounded');
        if (this.setup && this.$bgService.loaded) {
            this.inSetup = true;
            const params = this.getParams();
            this.setup.call(this, params);
            this.inSetup = false;
        }
    }
    onAppBackgrounded(args: ApplicationEventData) {
        // DEV_LOG && console.log(TAG, this.constructor.name, 'onAppBackgrounded', this.backgrounded);
        if (this.backgrounded) {
            return;
        }
        this.backgrounded = true;
        // DEV_LOG && console.log('onAppBackgrounded');
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
        DEV_LOG && console.log(TAG, this.constructor.name, 'callOnServiceStarted', this.backgrounded);
        if (this.setup && !this.backgrounded) {
            this.inSetup = true;
            this.setup.call(this, params);
            this.inSetup = false;
        }

        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceStarted.call(this, params);
    }
    unregisterSetupEvents() {
        const bluetoothHandler = this.$bgService.bluetoothHandler;
        const geoHandler = this.$bgService.geoHandler;
        const storyHandler = this.$bgService.storyHandler;
        DEV_LOG && console.log(TAG, this.constructor.name, 'unregisterSetupEvents');
        if (bluetoothHandler) {
            this.handlersSetupListeners['bluetooth']?.forEach((r) => {
                bluetoothHandler.off(r[0], r[1], r[2] || this);
            });
        }

        if (geoHandler) {
            this.handlersSetupListeners['geo']?.forEach((r) => {
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        if (storyHandler) {
            this.handlersSetupListeners['story']?.forEach((r) => {
                storyHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.handlersSetupListeners = {};
    }
    unregisterEvents() {
        const bluetoothHandler = this.$bgService.bluetoothHandler;
        const geoHandler = this.$bgService.geoHandler;
        const storyHandler = this.$bgService.storyHandler;
        if (bluetoothHandler) {
            this.handlersListeners['bluetooth']?.forEach((r) => {
                bluetoothHandler.off(r[0], r[1], r[2] || this);
            });
        }

        if (geoHandler) {
            this.handlersListeners['geo']?.forEach((r) => {
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        if (storyHandler) {
            this.handlersListeners['story']?.forEach((r) => {
                storyHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.handlersListeners = {};
    }
    unloadService() {
        DEV_LOG && console.log('unloadService');
        this.unregisterSetupEvents();
        this.unregisterEvents();
        this.onServiceUnloaded.call(this, this.getParams());
    }

    getParams() {
        const geoHandler = this.geoHandler;
        const dbHandler = this.dbHandler;
        const storyHandler = this.storyHandler;
        const bluetoothHandler = this.bluetoothHandler;
        return { geoHandler, dbHandler, bluetoothHandler, storyHandler };
    }

    private handlersSetupListeners: { [k: string]: any[] } = {};
    private handlersListeners: { [k: string]: any[] } = {};

    addHandlerListener(handler: string, event, listener, context = this) {
        if (this.inSetup) {
            const listeners = this.handlersSetupListeners[handler] || [];
            listeners.push([event, listener]);
            this.handlersSetupListeners[handler] = listeners;
        } else {
            const listeners = this.handlersListeners[handler] || [];
            listeners.push([event, listener]);
            this.handlersListeners[handler] = listeners;
        }
    }

    bluetoothHandlerOn(event, listener, context = this) {
        this.addHandlerListener('bluetooth', event, listener, context);
        this.bluetoothHandler.on(event, listener, context);
        return this;
    }
    geoHandlerOn(event, listener, context = this) {
        this.addHandlerListener('geo', event, listener, context);
        this.geoHandler.on(event, listener, context);
        return this;
    }
    storyHandlerOn(event, listener, context = this) {
        this.addHandlerListener('story', event, listener, context);
        this.storyHandler.on(event, listener, context);
        return this;
    }

    get geoHandler(): GeoHandler {
        return this.$bgService?.geoHandler;
    }
    get dbHandler(): DBHandler {
        return this.$bgService?.dbHandler;
    }
    get bluetoothHandler(): BluetoothHandler {
        return this.$bgService?.bluetoothHandler;
    }
    get storyHandler(): StoryHandler {
        return this.$bgService?.storyHandler;
    }
    onServiceLoaded(handlers: BgServiceMethodParams) {}
    onServiceStarted(handlers: BgServiceMethodParams) {}
    onServiceUnloaded(handlers: BgServiceMethodParams) {}
}
