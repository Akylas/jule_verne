import { isSimulator } from '@nativescript-community/extendedinfo';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Drawer } from '@nativescript-community/ui-drawer';
import { alert, prompt } from '@nativescript-community/ui-material-dialogs';
import { AndroidActivityBackPressedEventData, AndroidApplication, Application, ApplicationSettings, EventData, File, Frame, GestureEventData, knownFolders, path } from '@nativescript/core';
import { filesize } from 'filesize';
import { Component } from 'vue-property-decorator';
import { BaseVueComponentRefs } from '~/components/BaseVueComponent';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import MapComponent from '~/components/MapComponent.vue';
import { AvailableConfigsEvent, GlassesMemoryChangeEvent } from '~/handlers/BluetoothHandler';
import {
    GeoLocation,
    SessionEventData,
    SessionState,
    SessionStateEvent,
    UserRawLocationEvent
} from '~/handlers/GeoHandler';
import { ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { $tc } from '~/helpers/locale';
import Track, { TrackFeature } from '~/models/Track';
import { Catch, off as appOff, on as appOn } from '~/utils';
import { confirm } from '~/utils/dialogs';
import { bboxify } from '~/utils/geo';
import { getWorkingDir } from '~/utils/utils';
import { backgroundColor, mdiFontFamily, textColor } from '~/variables';
import { date } from '~/vue.filters';
import { ComponentIds } from '~/vue.prototype';
// import AudioPlayerWidget from '~/component/AudioPlayerWidget';
import GlassesConnectionComponent from '~/components/GlassesConnectionComponent';
import GlassesIcon from '~/components/GlassesIcon.vue';
import { FeatureViewedEvent, InsideFeatureEvent, PositionStateEvent, TrackSelecteEvent, UserLocationdEventData } from '~/handlers/StoryHandler';

export interface HomeRefs extends BaseVueComponentRefs {
    [key: string]: any;
}

@Component({
    components: {
        MapComponent,
        GlassesIcon
    }
})
export default class Home extends GlassesConnectionComponent {
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

    glassesMemory: FreeSpaceData = null;
    appVersion = __APP_VERSION__ + '.' + __APP_BUILD_NUMBER__;
    item: { title: string; icon: string; component; url: string; activated: boolean };

    bigImage = false;
    aimingAngle: number = 0;
    eventsLog: string = '';
    selectedTrack: Track = null;
    selectedTracks: Track[] = null;
    insideFeature: TrackFeature = null;
    availableConfigs: ConfigListData = null;

    viewedFeatures = null;

    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    needsImportOldSessionsOnLoaded = false;

    get drawer() {
        return this.getRef<Drawer>('drawer');
    }
    get map() {
        const mapComp = this.$refs.mapComp as MapComponent;
        return mapComp && mapComp['cartoMap'];
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
            return `${$tc('configs')}:\n${this.availableConfigs.map((c) => `${c.name}: ${filesize(c.size)}`).join('\n')}`;
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
    onError(event) {
        this.showError(event.data);
    }
    mounted() {
        super.mounted();
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
            this.eLog(e.feature.id, e.feature.properties.name, e.state, e.distance);
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
        if (!DISABLE_UPDATES && (PRODUCTION || !isSimulator())) {
            this.$networkService.checkForGlassesDataUpdate();
        }
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
        if (this.dbHandler && this.dbHandler.started) {
            this.importDevSessions();
        } else {
            this.needsImportOldSessionsOnLoaded = true;
        }
        if (PRODUCTION || !isSimulator()) {
            this.$networkService.checkForMapDataUpdate();
        }
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
        super.setup(handlers);
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.storyHandlerOn(TrackSelecteEvent, this.onTrackSelected, this);
        this.storyHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        this.storyHandlerOn(InsideFeatureEvent, this.onInsideFeature, this);
        this.storyHandlerOn(FeatureViewedEvent, this.onFeatureViewed, this);
        this.onNewLocation({
            error: null,
            location: handlers.storyHandler.lastLocation,
            aimingFeature: handlers.storyHandler.aimingFeature,
            aimingAngle: handlers.storyHandler.aimingAngle,
            isInTrackBounds: handlers.storyHandler.isInTrackBounds
        } as any);

        this.bluetoothHandlerOn(AvailableConfigsEvent, this.onAvailableConfigs, this);
        this.bluetoothHandlerOn(GlassesMemoryChangeEvent, this.onGlassesMemory);

        this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.onTrackSelected({ track: this.storyHandler.currentTrack } as any);
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
            if (PRODUCTION || !isSimulator()) {
                await this.$networkService.checkForGeoJSONUpdate(geojsonPath);
            }
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
                if (this.storyHandler.currentTrack?.id === newTrack.id) {
                    this.storyHandler.currentTrack = newTrack;
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

    @Catch()
    async onTap(command: string, ...args) {
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
                this.$drawer.toggle('left');
                break;
            case 'settings':
                await this.$navigateToUrl(ComponentIds.Settings);
                break;
            case 'connectGlasses':
                if (this.connectedGlasses) {
                    this.drawer.toggle('right');
                } else {
                    if (!this.bluetoothHandler.isEnabled()) {
                        await this.bluetoothHandler.enable();
                    }
                    this.pickGlasses();
                }

                break;
            case 'playStory':
                await this.storyHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                // await this.bluetoothHandler.playInstruction('starting_story');
                await this.storyHandler.playRideauAndStory(args[0]);
                break;
            case 'start':
                await this.storyHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                await this.storyHandler.playInstruction(command);
                break;
            case 'exit':
            case 'uturn':
            case 'right':
                await this.storyHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
                await this.storyHandler.playNavigationInstruction(command);
                break;
            case 'stopPlaying':
                await this.storyHandler.stopPlayingLoop({ fade: true, ignoreNext: true });
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
        }
    }

    @Catch()
    async onNavItemTap(item) {
        this.$navigateToUrl(item.url, { component: item.component });
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

    @Catch()
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

    onGlassesMemory(e: { data: FreeSpaceData }) {
        this.glassesMemory = e.data;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
}
