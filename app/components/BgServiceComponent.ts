import { BgServiceLoadedEvent } from '~/services/BgService';
import { GeoHandler, ImperialUnitChangedEvent } from '~/handlers/GeoHandler';
import BaseVueComponent from './BaseVueComponent';
import { ApplicationEventData, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
import { setBoolean } from '@nativescript/core/application-settings';
import { BgServiceStartedEvent } from '~/services/BgService.common';

export default abstract class BgServiceComponent extends BaseVueComponent {
    constructor() {
        super();
    }
    appPaused = false;
    mImperialUnit = false;
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

    get imperialUnit() {
        return this.mImperialUnit;
    }
    set imperialUnit(value: boolean) {
        this.mImperialUnit = this.geoHandler.imperialUnit = value;
        setBoolean('unit_imperial', value);
    }

    onAppResume(args: ApplicationEventData) {
        if (!this.appPaused) {
            return;
        }
        this.appPaused = false;
        if (this.setup && this.$bgService.loaded) {
            this.setup.call(this, this.$bgService.geoHandler);
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (this.appPaused) {
            return;
        }
        this.appPaused = true;
        if (this.unsetup) {
            this.unsetup.call(this, this.$bgService.geoHandler);
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
    setup?(geoHandler: GeoHandler);
    unsetup?(geoHandler: GeoHandler);

    onImperialUnitChanged?(value: boolean);
    callOnServiceLoaded() {
        const geoHandler = this.$bgService.geoHandler;
        this.mImperialUnit = geoHandler.imperialUnit;
        this.geoHandlerOn(ImperialUnitChangedEvent, (e) => {
            this.mImperialUnit = e.data;
            this.onImperialUnitChanged && this.onImperialUnitChanged(this.mImperialUnit);
        });
        if (this.setup && !this.appPaused) {
            this.setup.call(this, geoHandler);
        }
        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceLoaded.call(this, geoHandler);
    }
    callOnServiceStarted() {
        const geoHandler = this.$bgService.geoHandler;

        // call onServiceLoaded after setup to make sure everything is set up. onServiceLoaded will be
        // callled only once
        this.onServiceStarted.call(this, geoHandler);
    }
    unregisterEvents() {
        const geoHandler = this.$bgService.geoHandler;
        if (geoHandler) {
            this.geoHandlerListeners.forEach((r) => {
                geoHandler.off(r[0], r[1], r[2] || this);
            });
        }

        this.geoHandlerListeners = [];
    }
    unloadService() {
        const geoHandler = this.$bgService.geoHandler;
        this.unregisterEvents();
        this.onServiceUnloaded.call(this, geoHandler);
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
    onServiceLoaded(geoHandler: GeoHandler) {}
    onServiceStarted(geoHandler: GeoHandler) {}
    onServiceUnloaded(geoHandler: GeoHandler) {}
}
