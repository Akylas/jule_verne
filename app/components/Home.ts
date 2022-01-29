import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { prompt } from '@nativescript-community/ui-material-dialogs';
import * as application from '@nativescript/core/application';
import { EventData } from '@nativescript/core/data/observable';
import { Frame } from '@nativescript/core/ui/frame';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { bind } from 'helpful-decorators';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import {
    BLEBatteryEventData,
    BLEConnectionEventData,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesConnectionEventData,
    GlassesDisconnectedEvent,
    Peripheral,
    SPOTA_SERVICE_UUID,
    StatusChangedEvent
} from '~/handlers/BluetoothHandler';
import {
    FeatureViewedEvent,
    GeoLocation,
    InsideFeatureEvent,
    PositionStateEvent,
    SessionEventData,
    SessionState,
    SessionStateEvent,
    TrackSelecteEvent,
    UserLocationdEventData,
    UserRawLocationEvent
} from '~/handlers/GeoHandler';
import { $tc } from '~/helpers/locale';
import Track, { TrackFeature } from '~/models/Track';
import { confirm } from '~/utils/dialogs';
import { ComponentIds } from './App';
import { BaseVueComponentRefs } from './BaseVueComponent';
import DeviceSelect from './DeviceSelect';
import Map from './Map';
import MapComponent from './MapComponent';
import MapOnlyComponent from './MapOnlyComponent';

const production = TNS_ENV === 'production';
const TAG = 'Home';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export interface HomeRefs extends BaseVueComponentRefs {
    [key: string]: any;
}

@Component({
    components: {
        MapOnlyComponent,
        MapComponent,
        Map
    }
})
export default class Home extends BgServiceComponent {
    navigateUrl = ComponentIds.Activity;
    $refs: HomeRefs;
    public isWatchingLocation: boolean = false;
    public searchingLocation: boolean = false;
    public lastLocation: GeoLocation = null;
    public currentSessionState: SessionState = SessionState.STOPPED;
    public shouldConfirmBack = true;

    public connectedGlasses: GlassesDevice = null;
    public glassesBattery: number = 0;
    public glassesSerialNumber = null;
    public glassesVersion = null;
    bluetoothEnabled = true;

    aimingAngle: number = 0;
    eventsLog: string = '';
    selectedTrack: Track = null;
    selectedTracks: Track[] = null;
    insideFeature: TrackFeature = null;

    viewedFeatures = null;

    get map() {
        const mapComp = this.$refs.mapComp as MapComponent;
        return mapComp && mapComp.cartoMap;
    }
    get connectedGlassesName() {
        return this.connectedGlasses?.localName || '';
    }
    get glassesSubtitle() {
        let result = '';
        if (this.glassesSerialNumber) {
            result += `${this.glassesSerialNumber}`;
        }
        if (this.glassesVersion) {
            result += ` (${this.glassesVersion})`;
        }
        return result;
    }
    mounted() {
        super.mounted();
    }
    eLog(...args) {
        console.log.apply(
            this,
            args.filter((s) => s !== undefined)
        );
        this.eventsLog = args.join(' ') + '\n' + this.eventsLog;
    }
    onInsideFeature(event: EventData) {
        this.insideFeature = event['data'].feature;
    }
    onFeatureViewed(event: EventData) {
        this.viewedFeatures = event['data'].featureViewed;
        console.log('onFeatureViewed', this.viewedFeatures);
    }
    onTrackPositionState(event: EventData) {
        const events: { index: number; distance?: number; trackId: string; state: 'inside' | 'leaving' | 'entering'; feature: TrackFeature }[] = event['data'].events;
        // const { feature, index, distance, state } = event['data'];
        // if (state === 'entering') {
        //     this.insideFeature = feature;
        // } else if (state === 'leaving' && this.insideFeature === feature) {
        //     this.insideFeature = null;
        // }
        events.forEach((e) => {
            this.eLog(e.feature.id, e.feature.properties.name, e.state, e.distance, index);
        });
    }
    onTrackSelected(event: EventData) {
        const track = event['track'] as Track;
        this.selectedTrack = track;
        this.selectedTracks = [track];
        const map = this.map;
        if (track && map) {
            map.moveToFitBounds(track.bounds, undefined, true, true, false, 200);
        }
    }

    destroyed() {
        super.destroyed();
        if (__ANDROID__) {
            application.android.off(application.AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }

    async onServiceStarted(handlers: BgServiceMethodParams) {
        // this.tracks.push(geoHandler.currentTrack);
    }
    // updateMapWithSession() {
    //     const map = this._cartoMap;
    //     const mapBounds = this.tracks[0].bounds;
    //     const zoomLevel = getBoundsZoomLevel(mapBounds, { width: layout.toDeviceIndependentPixels(map.getMeasuredWidth()), height: layout.toDeviceIndependentPixels(map.getMeasuredHeight()) });
    //     map.setZoom(Math.min(zoomLevel - 1, 20), 0);
    //     map.setFocusPos(getCenter(mapBounds.northeast, mapBounds.southwest), 0);
    // }
    // onMapReady(e) {
    //     const cartoMap = (this._cartoMap = e.object as CartoMap<LatLonKeys>);
    //     if (!this.mapInitialized && cartoMap.getMeasuredWidth()) {
    //         this.updateMapWithSession();
    //     }
    // }
    async onMapReady(e) {
        if (this.selectedTrack) {
            (e.object as CartoMap<LatLonKeys>).moveToFitBounds(this.selectedTrack.bounds, undefined, true, true, false, 0);
        }
    }

    protected onSessionStateEvent(e: SessionEventData) {
        console.log('onSessionStateEvent', e.data);
        this.currentSessionState = e.data.state;
    }
    inFront = false;
    onNavigatingTo() {
        this.inFront = true;

        // if (__ANDROID__) {
        //     application.android.on(application.AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        // }
    }
    onNavigatingFrom() {
        this.inFront = false;

        // if (__ANDROID__) {
        //     application.android.off(application.AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        // }
    }
    onAndroidBackButton(data: application.AndroidActivityBackPressedEventData) {
        if (__ANDROID__) {
            if (!this.inFront) {
                return;
            }
            if (this.shouldConfirmBack && this.currentSessionState !== SessionState.STOPPED) {
                data.cancel = true;
                const frame = Frame.topmost();
                confirm({
                    title: this.$t('stop_session'),
                    message: this.$t('stop_session_are_you_sure'),
                    okButtonText: this.$t('close'),
                    cancelButtonText: this.$t('cancel')
                })
                    .then((result) => {
                        if (result) {
                            this.shouldConfirmBack = false;
                            this.geoHandler.stopSession();
                            console.log('about to close activity', result);
                            setTimeout(() => {
                                frame.android.activity.finish();
                            }, 10);
                        }
                    })
                    .catch(this.showError);
            }
            this.shouldConfirmBack = true;
        }
    }
    positions: GeoLocation[] = null;

    get sessionPaused() {
        return this.currentSessionState === SessionState.PAUSED;
    }
    get sessionRunning() {
        return this.currentSessionState === SessionState.RUNNING;
    }
    get sessionStopped() {
        return this.currentSessionState === SessionState.STOPPED;
    }

    currenWaitingForFirstPosition = false;
    set waitingForFirstPosition(value) {
        // this.log('set waitingForFirstPosition', value, this.currenWaitingForFirstPosition);
        if (this.currenWaitingForFirstPosition !== value) {
            this.currenWaitingForFirstPosition = value;
        }
    }
    get waitingForFirstPosition() {
        return this.currenWaitingForFirstPosition;
    }

    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandlerOn(TrackSelecteEvent, this.onTrackSelected, this);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        this.geoHandlerOn(InsideFeatureEvent, this.onInsideFeature, this);
        this.onNewLocation({
            error: null,
            location: handlers.geoHandler.lastLocation,
            aimingFeature: handlers.geoHandler.aimingFeature,
            aimingAngle: handlers.geoHandler.aimingAngle,
            isInTrackBounds: handlers.geoHandler.isInTrackBounds
        } as any);
        this.geoHandlerOn(FeatureViewedEvent, this.onFeatureViewed, this);

        this.bluetoothHandlerOn('drawBitmap', this.onDrawImage);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.bluetoothHandlerOn(StatusChangedEvent, this.onBLEStatus);

        this.connectingToGlasses = handlers.bluetoothHandler.connectingToGlasses;
        if (!handlers.bluetoothHandler.glasses) {
            this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        }
        handlers.bluetoothHandler.isEnabled().then((r) => {
            this.bluetoothEnabled = r;
            if (r && !handlers.bluetoothHandler.glasses) {
                this.tryToAutoConnect();
            } else if (!r && handlers.bluetoothHandler.savedGlassesUUID) {
                this.showError(this.$t('bluetooth_not_enabled'));
            }
        });
        this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.onTrackSelected({ track: this.geoHandler.currentTrack } as any);
    }

    get currentBearing() {
        if (this.lastLocation) {
            return this.lastLocation.bearing || 0;
        }
        return 0;
    }
    get currentComputedBearing() {
        if (this.lastLocation) {
            return this.lastLocation.computedBearing || 0;
        }
        return 0;
    }

    @bind
    onNewLocation(data: UserLocationdEventData) {
        if (data.error) {
            this.showError(data.error);
            return;
        }
        this.lastLocation = data.location;
        this.aimingAngle = data.aimingAngle;
        this.searchingLocation = false;
    }

    async onTap(command: string, ...args) {
        try {
            switch (command) {
                case 'location':
                    if (this.searchingLocation) {
                        return;
                    }
                    try {
                        await this.geoHandler.enableLocation();
                        this.searchingLocation = true;
                        await this.geoHandler.getLocation();
                    } catch (err) {
                        this.showError(err);
                    } finally {
                        this.searchingLocation = false;
                    }
                    break;
                case 'startSession':
                    if (this.currentSessionState === SessionState.PAUSED) {
                        this.geoHandler.resumeSession();
                    } else if (this.currentSessionState === SessionState.RUNNING) {
                        this.geoHandler.pauseSession();
                    } else {
                        try {
                            await this.geoHandler.askForSessionPerms();
                            await this.geoHandler.startSession();
                        } catch (err) {
                            this.showError(err);
                        }
                    }

                    break;
                case 'stopSession':
                    confirm({
                        title: this.$t('stop_session'),
                        message: this.$t('stop_session_are_you_sure'),
                        okButtonText: this.$t('stop'),
                        cancelButtonText: this.$t('cancel')
                    })
                        .then((result) => {
                            if (result) {
                                return this.geoHandler.stopSession().then((session) => {
                                    this.lastLocation = null;
                                });
                            }
                        })
                        .catch(this.showError);
                    break;
                case 'menu':
                    this.$getAppComponent().drawer.open();
                    break;
                case 'settings':
                    this.$getAppComponent().navigateToUrl(ComponentIds.Settings);
                    break;
                case 'connectGlasses':
                    if (this.connectedGlasses) {
                        this.$refs.drawer.nativeView.toggle();
                    } else {
                        if (!this.bluetoothHandler.isEnabled()) {
                            this.bluetoothHandler.enable();
                        } else {
                            this.pickGlasses();
                        }
                    }

                    break;
                case 'playStory':
                    await this.bluetoothHandler.playStory(args[0]);
                    break;
                case 'hello':
                    await this.bluetoothHandler.playInstruction('start', { randomize: true });
                    break;
                case 'rideau':
                    console.log('rideau');
                    await this.bluetoothHandler.playRideauAndStory();
                    break;
                case 'demitour':
                    await this.bluetoothHandler.playInstruction('uturn', { frameDuration: 400 });
                    break;
                case 'stopPlaying':
                    this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                    break;
                case 'changeDeviceName':
                    prompt({
                        title: $tc('change_glasses_name'),
                        // message: $tc('change_glasses_name'),
                        okButtonText: $tc('change'),
                        cancelButtonText: $tc('cancel'),
                        autoFocus: true,
                        defaultText: this.connectedGlasses.localName,
                        textFieldProperties: {
                            marginLeft: 10,
                            marginRight: 10,
                            hint: $tc('name')
                        }
                    })
                        .then((result) => {
                            console.log(TAG, 'changeDeviceName', result, this.connectedGlasses.localName);
                            if (result && !!result.result && result.text.length > 0 && result.text !== this.connectedGlasses.localName) {
                                return this.bluetoothHandler.setGlassesName(result.text).then(() =>
                                    alert({
                                        title: $tc('glasses_updated'),
                                        message: $tc('reboot_glasses_required'),
                                        okButtonText: $tc('ok')
                                    })
                                );
                            }
                        })
                        .catch(this.showError);
                    break;
            }
        } catch (err) {
            this.showError(err);
        }
    }
    enableForScan() {
        return this.bluetoothHandler
            .enable()
            .then(() => this.geoHandler.enableLocation())
            .then(() => timeout(100)); // the timeout is for and android bug on some device/android where we would try to show a modal view too quckly after a native prompt
    }
    connectingToGlasses = false;
    async pickGlasses() {
        try {
            await this.enableForScan();
            const options = {
                props: {
                    title: this.$t('looking_for_glasses'),
                    scanningParams: {
                        glasses: true,
                        // nameFilter: /Microoled/,
                        filters: [
                            {
                                serviceUUID: SPOTA_SERVICE_UUID
                            }
                        ]
                    }
                },
                animated: true,
                fullscreen: true
            };
            const device: Peripheral = await this.$showModal(DeviceSelect, options);
            // console.log(TAG, 'connecting to picked device', device);
            if (device) {
                this.connectingToGlasses = true;
                return this.bluetoothHandler.connect(device.UUID);
            }
        } catch (err) {
            this.showError(err);
        }
    }
    get insideFeatureName() {
        const properties = this.insideFeature.properties;
        const name = 'index' in properties ? properties.index : properties.name;
        return name;
    }
    // playCurrentStory() {
    //     console.log('playCurrentStory', !!this.insideFeature);
    //     if (this.insideFeature) {
    //         const name = this.insideFeatureName;
    //         this.geoHandler.playStory(name);
    //     }
    // }

    onLongPress(command: string, args: GestureEventData) {
        if (args.ios && args.ios.state !== 3) {
            return;
        }
        switch (command) {
            case 'disconnectGlasses':
                if (this.connectedGlasses) {
                    confirm({
                        title: this.$tt('disconnect_glasses'),
                        message: this.$tc('disconnect_glasses_are_you_sure'),
                        okButtonText: this.$t('disconnect'),
                        cancelButtonText: this.$t('cancel')
                    }).then((result) => {
                        console.log(TAG, 'disconnectGlasses, confirmed', result);
                        if (!!result) {
                            this.bluetoothHandler.disconnectGlasses(true);
                        }
                    });
                }
                break;
        }
    }

    updateGlassesBattery(value: number) {
        if (value >= 0) {
            this.glassesBattery = value;
        } else {
            this.glassesBattery = 0;
        }
    }

    onGlassesConnected(e: GlassesConnectionEventData) {
        const glasses = (this.connectedGlasses = e.data);
        this.connectingToGlasses = false;
        this.glassesVersion = glasses.firmwareVersion;
        this.glassesSerialNumber = glasses.serialNumber;
        setTimeout(() => {
            this.hideLoading();
        }, 200);
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        console.log(TAG, 'onGlassesDisconnected', e.manualDisconnect);
        this.connectedGlasses = null;
        this.connectingToGlasses = false;
        this.glassesBattery = -1;
        this.glassesVersion = null;
        this.glassesSerialNumber = null;
        this.hideLoading();
    }
    onGlassesBattery(e: BLEBatteryEventData) {
        this.updateGlassesBattery(e.data);
    }
    tryToAutoConnect() {
        if (this.bluetoothHandler.isEnabled() && this.bluetoothHandler.hasSavedGlasses() && !this.bluetoothHandler.connectingToGlasses) {
            // this.enableForScan()
            //     .then(() => {
            this.connectingToGlasses = true;
            return this.bluetoothHandler
                .connectToSaved()
                .then(() => {
                    console.log(TAG, 'Pairing connectToSaved done', this.bluetoothHandler.connectingToSavedGlasses, this.bluetoothHandler.connectingToGlasses);
                    this.connectingToGlasses = this.bluetoothHandler.connectingToSavedGlasses || this.bluetoothHandler.connectingToGlasses;
                })
                .catch(this.showError);
        }
    }
    onBLEStatus(e) {
        console.log(TAG, 'onBLEStatus', e.data.state);
        const newValue = e.data.state === 'on';
        if (newValue !== this.bluetoothEnabled) {
            this.bluetoothEnabled = newValue;
            if (newValue) {
                this.tryToAutoConnect();
            }
        }
    }

    onDrawImage(event) {
        // console.log('onDrawImage', event.bitmap);
        this.$refs.imageView.nativeView.src = event.bitmap;
        // this.currentDrawImage = event.bitmap;
    }
}
