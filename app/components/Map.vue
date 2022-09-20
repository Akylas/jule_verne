<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <GridLayout backgroundColor="white" rows="auto,*">
            <CActionBar showMenuIcon>
                <GlassesIcon :glasses="connectedGlasses" :battery="glassesBattery" />
            </CActionBar>
            <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton row="1" :tracks="selectedTracks" :viewedFeature="viewedFeatures" />
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { EventData } from '@akylas/nativescript';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { AndroidApplication, Application, Frame } from '@nativescript/core';
import { AndroidActivityBackPressedEventData } from '@nativescript/core/application';
import { Component } from 'vue-property-decorator';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import GlassesIcon from '~/components/GlassesIcon.vue';
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
import Track, { TrackFeature } from '~/models/Track';
import { ComponentIds } from '~/vue.prototype';
import { BaseVueComponentRefs } from './BaseVueComponent';
import GlassesConnectionComponent from './GlassesConnectionComponent';
import MapComponent from './MapComponent';

export interface HomeRefs extends BaseVueComponentRefs {
    [key: string]: any;
    mapComp: MapComponent;
}

@Component({
    components: {
        MapComponent,
        GlassesIcon
    }
})
export default class Map extends GlassesConnectionComponent {
    navigateUrl = ComponentIds.Map;
    loading = false;
    selectedTrack: Track = null;
    selectedTracks: Track[] = null;
    insideFeature: TrackFeature = null;

    inFront = true;
    viewedFeatures = null;
    public isWatchingLocation: boolean = false;
    public searchingLocation: boolean = false;
    public lastLocation: GeoLocation = null;
    public currentSessionState: SessionState = SessionState.STOPPED;
    public shouldConfirmBack = true;
    get map() {
        const mapComp = this.$refs.mapComp as MapComponent;
        return mapComp && mapComp.cartoMap;
    }
    mounted() {
        super.mounted();
        this.$refs.mapComp.askUserLocation();
    }
    destroyed() {
        super.destroyed();
    }
    async onMapReady(e) {
        if (this.selectedTrack) {
            (e.object as CartoMap<LatLonKeys>).moveToFitBounds(this.selectedTrack.bounds, undefined, true, true, false, 0);
        }
    }

    protected onSessionStateEvent(e: SessionEventData) {
        this.currentSessionState = e.data.state;
    }
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
    onUpdateSessionEvent(e: SessionEventData) {
        // this.log('onUpdateSessionEvent');
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
        // events.forEach((e) => {
        //     this.eLog(e.feature.id, e.feature.properties.name, e.state, e.distance, index);
        // });
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
    onNewLocation(data: UserLocationdEventData) {
        if (data.error) {
            this.showError(data.error);
            return;
        }
        this.lastLocation = data.location;
        this.searchingLocation = false;
    }

    setup(handlers: BgServiceMethodParams) {
        super.setup(handlers);
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
        this.geoHandlerOn('error', this.onError);

        this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.onTrackSelected({ track: this.geoHandler.currentTrack } as any);
    }
    onInsideFeature(event: EventData) {
        this.insideFeature = event['data'].feature;
    }
}
</script>
