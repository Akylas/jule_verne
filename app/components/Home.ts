import { CartoMap } from '@nativescript-community/ui-carto/ui';
import * as application from '@nativescript/core/application';
import { EventData } from '@nativescript/core/data/observable';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { Frame } from '@nativescript/core/ui/frame';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { bind } from 'helpful-decorators';
import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GeoHandler, GeoLocation, PositionStateEvent, SessionEventData, SessionState, SessionStateEvent, TrackSelecteEvent, UserLocationdEventData, UserRawLocationEvent } from '~/handlers/GeoHandler';
import Track from '~/models/Track';
import { confirm } from '~/utils/dialogs';
import { ComponentIds } from './App';
import { BaseVueComponentRefs } from './BaseVueComponent';
import Map from './Map';
import MapComponent from './MapComponent';
import MapOnlyComponent from './MapOnlyComponent';

const production = TNS_ENV === 'production';

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
    public lastLocation: GeoLocation;
    public currentSessionState: SessionState = SessionState.STOPPED;
    public shouldConfirmBack = true;
    tracks: ObservableArray<Track> = new ObservableArray([]);

    get map() {
        const mapComp = this.$refs.mapComp as MapComponent;
        return mapComp && mapComp.cartoMap;
    }
    mounted() {
        super.mounted();

        if (global.isAndroid) {
            application.android.on(application.AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }
    eventsLog: string = '';
    eLog(...args) {
        this.log.apply(
            this,
            args.filter((s) => s !== undefined)
        );
        this.eventsLog = args.join(' ') + '\n' + this.eventsLog;
    }
    onTrackPositionState(event: EventData) {
        const { feature, index, distance, state } = event['data'];
        this.eLog(feature.id, feature.properties.name, state, distance, index);
    }
    onTrackSelected(event: EventData) {
        const track = event['track'] as Track;
        // console.log('onTrackSelected', track && track.id);
        this.tracks.splice(0, 1, track);
        const map = this.map;
        if (track && map) {
            map.moveToFitBounds(track.bounds, undefined, true, true, false, 200);
        }
    }

    destroyed() {
        super.destroyed();
        if (global.isAndroid) {
            application.android.off(application.AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }

    async onServiceStarted(geoHandler: GeoHandler) {
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
        if (this.tracks.length > 0) {
            (e.object as CartoMap<LatLonKeys>).moveToFitBounds(this.tracks.getItem(0).bounds, undefined, true, true, false, 0);
        }
    }

    protected onSessionStateEvent(e: SessionEventData) {
        console.log('onSessionStateEvent', e.data);
        this.currentSessionState = e.data.state;
    }
    onAndroidBackButton(data: application.AndroidActivityBackPressedEventData) {
        if (global.isAndroid) {
            if (!this.$getAppComponent().isActiveUrl(ComponentIds.Activity)) {
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
                            this.log('about to close activity', result);
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

    setup(geoHandler: GeoHandler) {
        if (!geoHandler) {
            return;
        }
        console.log('setup');
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandlerOn(TrackSelecteEvent, this.onTrackSelected, this);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);

        this.isWatchingLocation = geoHandler.isWatching();
    }

    @bind
    onNewLocation(data: UserLocationdEventData) {
        if (data.error) {
            this.showError(data.error);
            return;
        }
        this.lastLocation = data.location;
        this.searchingLocation = false;
    }

    onNavigatingFrom() {}
    onNavigatingTo() {}

    async onTap(command: string, args: GestureEventData) {
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
        }
    }

    //@ts-ignore
}
