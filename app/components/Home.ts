import { MapBounds } from '@nativescript-community/ui-carto/core';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Drawer } from '@nativescript-community/ui-drawer';
import { prompt } from '@nativescript-community/ui-material-dialogs';
import {
    AndroidActivityBackPressedEventData,
    AndroidApplication,
    Application,
    ApplicationSettings,
    EventData,
    File,
    Frame,
    GestureEventData,
    ObservableArray,
    knownFolders,
    path
} from '@nativescript/core';
import fileSize from 'filesize';
import { bind } from 'helpful-decorators';
import { Vibrate } from 'nativescript-vibrate';
import Vue from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { GlassesDevice, GlassesVersions } from '~/handlers/bluetooth/GlassesDevice';
import {
    AvailableConfigsEvent,
    BLEBatteryEventData,
    BLEConnectionEventData,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesDisconnectedEvent,
    GlassesMemoryChangeEvent,
    Peripheral,
    SPOTA_SERVICE_UUID,
    SerialEvent,
    StatusChangedEvent,
    VersionEvent
} from '~/handlers/BluetoothHandler';
import {
    AvailableStoriesEvent,
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
import { ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { $tc } from '~/helpers/locale';
import Track, { TrackFeature } from '~/models/Track';
import { off as appOff, on as appOn } from '~/utils';
import { confirm } from '~/utils/dialogs';
import { bboxify } from '~/utils/geo';
import { getGlassesImagesFolder, getWorkingDir } from '~/utils/utils';
import { backgroundColor, mdiFontFamily, textColor } from '~/variables';
import { date } from '~/vue.filters';
import { ComponentIds } from '~/vue.prototype';
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
    date = date;
    mdiFontFamily = mdiFontFamily;
    backgroundColor = backgroundColor;
    textColor = textColor;
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
    public glassesVersions: GlassesVersions = null;
    glassesMemory: FreeSpaceData = null;
    bluetoothEnabled = true;
    appVersion = __APP_VERSION__ + '.' + __APP_BUILD_NUMBER__;

    bigImage = false;
    aimingAngle: number = 0;
    eventsLog: string = '';
    selectedTrack: Track = null;
    selectedTracks: Track[] = null;
    insideFeature: TrackFeature = null;
    availableConfigs: ConfigListData = null;

    storyPlaying = false;
    storyPaused = false;

    viewedFeatures = null;

    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    needsImportOldSessionsOnLoaded = false;

    menuItems = new ObservableArray([
        {
            title: this.$t('map'),
            icon: 'mdi-map',
            component: async () => (await import('~/components/Home')).default,
            url: ComponentIds.Activity,
            activated: false
        },
        {
            title: this.$t('tracks'),
            icon: 'mdi-map-marker-path',
            component: async () => (await import('~/components/Tracks')).default,
            url: ComponentIds.Tracks,
            activated: false
        },
        // {
        //     title: this.$t('create_track'),
        //     icon: 'mdi-map-marker-distance',
        //     url: ComponentIds.Leaflet,
        //     activated: false
        // },
        {
            title: this.$t('settings'),
            icon: 'mdi-cogs',
            component: async () => (await import('~/components/Settings')).default,
            url: ComponentIds.Settings,
            activated: false
        },
        {
            title: this.$t('images'),
            icon: 'mdi-image',
            component: async () => (await import('~/components/Images.vue')).default,
            url: ComponentIds.Images,
            activated: false
        }
    ]);

    get drawer() {
        return this.getRef<Drawer>('drawer');
    }
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
        if (this.glassesVersions) {
            result += ` (${this.glassesVersions.firmware})`;
        }
        return result;
    }
    get availableConfigsLabel() {
        if (this.availableConfigs) {
            return `${$tc('configs')}:\n${this.availableConfigs.map((c) => `${c.name}: ${fileSize(c.size)}`).join('\n')}`;
        }
        return null;
    }
    onGlassesDataUpdateDate(event) {
        this.glassesDataUpdateDate = event.data;
    }
    onMapDataUpdateDate(event) {
        this.mapDataUpdateDate = event.data;
    }
    onGeojsonDataUpdateDate(event) {
        this.geojsonDataUpdateDate = event.data;
    }
    onStoryPlayingEvent(event) {
        this.storyPlaying = event.data !== 'stop';
        this.storyPaused = event.data === 'pause';
    }
    mounted() {
        super.mounted();
        this.$onAppMounted();
        appOn('GLASSES_DATA_LASTDATE', this.onGlassesDataUpdateDate, this);
        appOn('MAP_DATA_LASTDATE', this.onMapDataUpdateDate, this);
        appOn('GEOJSON_DATA_LASTDATE', this.onGeojsonDataUpdateDate, this);
    }
    destroyed() {
        appOff('GLASSES_DATA_LASTDATE', this.onGlassesDataUpdateDate, this);
        appOff('MAP_DATA_LASTDATE', this.onMapDataUpdateDate, this);
        appOff('GEOJSON_DATA_LASTDATE', this.onGeojsonDataUpdateDate, this);
        super.destroyed();
        if (__ANDROID__) {
            Application.android.off(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
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
    onAvailableConfigs(event: EventData) {
        this.availableConfigs = event['data'];
    }
    onFeatureViewed(event: EventData) {
        this.viewedFeatures = event['data'].featureViewed;
        DEV_LOG && console.log('onFeatureViewed', this.viewedFeatures);
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
        this.$networkService.checkForGlassesDataUpdate();
    }

    async onServiceStarted(handlers: BgServiceMethodParams) {
        // console.log('onServiceStarted', this.needsImportOldSessionsOnLoaded);
        if (this.needsImportOldSessionsOnLoaded) {
            this.needsImportOldSessionsOnLoaded = false;
            this.importDevSessions();
        }
    }
    onLoaded() {
        // GC();
        // console.log('onLoaded', this.needsImportOldSessionsOnLoaded);
        Vue.prototype.$drawer = this.drawer;
        if (this.dbHandler && this.dbHandler.started) {
            this.importDevSessions();
        } else {
            this.needsImportOldSessionsOnLoaded = true;
        }
        this.$networkService.checkForMapDataUpdate();
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
        this.currentSessionState = e.data.state;
    }
    inFront = false;
    onNavigatingTo() {
        this.inFront = true;
        if (__ANDROID__) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }
    onNavigatingFrom() {
        this.inFront = false;

        if (__ANDROID__) {
            Application.android.off(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }
    onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
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
        this.bluetoothHandlerOn(AvailableConfigsEvent, this.onAvailableConfigs, this);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(SerialEvent, this.onGlassesSerialNumber);
        this.bluetoothHandlerOn(VersionEvent, this.onGlassesVersion);
        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.bluetoothHandlerOn(GlassesMemoryChangeEvent, this.onGlassesMemory);
        this.bluetoothHandlerOn(StatusChangedEvent, this.onBLEStatus);
        this.bluetoothHandlerOn('storyPlayback', this.onStoryPlayingEvent);

        this.connectingToGlasses = handlers.bluetoothHandler.connectingToGlasses;
        if (handlers.bluetoothHandler.glasses) {
            this.onGlassesBattery({
                data: handlers.bluetoothHandler.glassesBattery
            } as any);
            this.onGlassesSerialNumber({
                data: handlers.bluetoothHandler.glasses.serialNumber
            } as any);
            this.onGlassesVersion({
                data: handlers.bluetoothHandler.glasses.versions
            } as any);
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

    async importDevSessions() {
        try {
            let geojsonPath = path.join(getWorkingDir(false), 'map.geojson');
            await this.$networkService.checkForGeoJSONUpdate(geojsonPath);
            if (!File.exists(geojsonPath)) {
                geojsonPath = path.join(knownFolders.currentApp().path, 'assets/data/map.geojson');
            }
            if (!File.exists(geojsonPath)) {
                return;
            }
            // this.showLoading({ text: this.$t('importing_data'), progress: 0 });
            const file = File.fromPath(geojsonPath);
            const lastChecked = ApplicationSettings.getNumber('map.geojson_date', 0);
            if (file.lastModified.getTime() <= lastChecked) {
                return;
            }
            const importData = file.readTextSync();
            const data = JSON.parse(importData);
            const existing = (await this.dbHandler.trackRepository.searchItem()).map((t) => t.id);
            for (let index = 0; index < data.length; index++) {
                const d = data[index];
                const track = { ...d, id: (d.name || Date.now()) + '' };
                const geojson = bboxify(track.geometry);
                track.geometry = geojson as any;
                // track.geometry = reader.readFeatureCollection(JSON.stringify(d.geometry));
                track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });

                let newTrack;
                if (existing.indexOf(track.id) === -1) {
                    newTrack = await this.dbHandler.trackRepository.createItem(track);
                } else {
                    newTrack = await this.dbHandler.trackRepository.updateItem(track);
                }
                if (this.geoHandler.currentTrack?.id === newTrack.id) {
                    this.geoHandler.currentTrack = newTrack;
                }
            }
            ApplicationSettings.setNumber('map.geojson_date', file.lastModified.getTime());
        } catch (err) {
            this.showError(err);
        } finally {
            // this.hideLoading();
        }
    }

    quitApp() {
        this.$bgService.stop().then(() => {
            if (__IOS__) {
                //@ts-ignore
                exit(0);
            } else {
                Application.android.startActivity.finish();
            }
        });
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
                    await confirm({
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
                    this.drawer.toggle('left');
                    break;
                case 'settings':
                    await this.$navigateToUrl(ComponentIds.Settings);
                    break;
                case 'connectGlasses':
                    if (this.connectedGlasses) {
                        this.drawer.toggle('right');
                    } else {
                        if (!this.bluetoothHandler.isEnabled()) {
                            this.bluetoothHandler.enable();
                        } else {
                            this.pickGlasses();
                        }
                    }

                    break;
                case 'playStory':
                    await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                    // await this.bluetoothHandler.playInstruction('starting_story');
                    this.bluetoothHandler.playRideauAndStory(args[0]);
                    break;
                case 'start':
                    await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                    await this.bluetoothHandler.playInstruction(command);
                    break;
                case 'exit':
                case 'uturn':
                case 'right':
                    await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                    await this.bluetoothHandler.playNavigationInstruction(command);
                    break;
                case 'stopPlaying':
                    await this.bluetoothHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                    break;
                case 'changeDeviceName':
                    const result = await prompt({
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
                    });
                    if (result && !!result.result && result.text.length > 0 && result.text !== this.connectedGlasses.localName) {
                        return this.bluetoothHandler.setGlassesName(result.text).then(() =>
                            alert({
                                title: $tc('glasses_updated'),
                                message: $tc('reboot_glasses_required'),
                                okButtonText: $tc('ok')
                            })
                        );
                    }
                    break;
                case 'toggleMusicPlayPause':
                    if (this.storyPlaying) {
                        if (this.storyPaused) {
                            this.bluetoothHandler.resumeStory();
                        } else {
                            this.bluetoothHandler.pauseStory();
                        }
                    }
                    break;
            }
        } catch (err) {
            this.showError(err);
        }
    }

    async onNavItemTap(item) {
        try {
            this.$navigateToUrl(item.url, { component: item.component });
        } catch (error) {
            this.showError(error);
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

    onGlassesBattery(e: BLEBatteryEventData) {
        this.updateGlassesBattery(e.data);
    }

    onGlassesMemory(e: { data: FreeSpaceData }) {
        this.glassesMemory = e.data;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
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

    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.connectingToGlasses = false;
        this.glassesBattery = -1;
        this.glassesVersions = null;
        this.glassesSerialNumber = null;
        this.hideLoading();
        // if not manual disconnect we are going to try and reconnect

        this.$crashReportService.setExtra('glasses', null);
        if (this.devMode) {
            const vibrator = new Vibrate();
            vibrator.vibrate(2000);
        }
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        const glasses = (this.connectedGlasses = e.data as GlassesDevice);
        this.connectingToGlasses = false;
        this.glassesVersions = glasses.versions;
        this.glassesSerialNumber = glasses.serialNumber;
        this.updateSentryInfos();
        this.hideLoading();
    }
    updateSentryInfos() {
        const glasses = this.connectedGlasses;
        if (glasses) {
            this.$crashReportService.setExtra(
                'glasses',
                JSON.stringify({
                    name: glasses.localName,
                    uuid: glasses.UUID,
                    versions: this.glassesVersions,
                    serial: this.glassesSerialNumber
                })
            );
        } else {
            this.$crashReportService.setExtra('glasses', null);
        }
    }
    onGlassesReconnecting() {
        this.showLoading(this.$t('connection_lost_reconnecting'));
    }
    onGlassesReconnectingFailed() {
        this.hideLoading();
    }
    onGlassesVersion(e) {
        this.glassesVersions = e.data;
        DEV_LOG && console.log('onGlassesVersion', this.glassesVersions);
        this.$networkService.checkFirmwareUpdateOnline(this.glassesVersions);
        this.updateSentryInfos();
    }
    onGlassesSerialNumber(e) {
        this.glassesSerialNumber = e.data;
        this.updateSentryInfos();
    }
}
