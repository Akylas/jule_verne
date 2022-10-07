<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatingTo="onNavigatingTo" @navigatingFrom="onNavigatingFrom">
        <GridLayout backgroundColor="white">
            <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton :tracks="selectedTracks" :viewedFeature="viewedFeatures" />
            <GlassesIcon :glasses="connectedGlasses" :battery="glassesBattery" verticalAlignment="top" horizontalAlignment="right" />
            <GridLayout :backgroundColor="backgroundColor" v-show="showStartText" row="1" margin="20" padding="20" borderRadius="30" verticalAlignment="center" rows="auto,auto">
                <Label textAlignment="center" fontSize="20">
                    <CSPan :text="$tc('all_good_title')" fontWeight="bold" />
                    <CSPan :text="'\n\n' + $tc('all_good_desc')" />
                </Label>
                <MDButton row="1" marginTop="20" :text="$tc('lets_go')" @tap="showStartText = false" horizontalAlignment="center" />
            </GridLayout>
            <MDButton horizontalAlignment="center" verticalAlignment="bottom" class="playerButton" :text="sessionPaused ? 'mdi-play' : 'mdi-pause'" @tap="toggleSessionState" />
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
import { Catch } from '~/utils';
import { backgroundColor } from '~/variables';
import { ComponentIds } from '~/vue.prototype';
import { BaseVueComponentRefs } from './BaseVueComponent';
import GlassesConnectionComponent from './GlassesConnectionComponent';
import MapComponent from './MapComponent.vue';

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
    backgroundColor = backgroundColor;
    loading = false;
    selectedTrack: Track = null;
    selectedTracks: Track[] = null;
    // insideFeature: TrackFeature = null;

    inFront = true;
    viewedFeatures = null;
    public isWatchingLocation: boolean = false;
    public searchingLocation: boolean = false;
    public lastLocation: GeoLocation = null;
    public currentSessionState: SessionState = SessionState.STOPPED;
    public shouldConfirmBack = true;
    public showStartText = true;
    get map() {
        const mapComp = this.$refs.mapComp as MapComponent;
        return mapComp && mapComp.cartoMap;
    }
    get sessionPaused() {
        return this.currentSessionState === SessionState.PAUSED;
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
        if (this.currentSessionState === SessionState.STOPPED) {
            this.$navigateBack();
        }
    }

    unsetup() {
        this.showStartText = false;
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
            if (this.currentSessionState !== SessionState.STOPPED) {
                data.cancel = true;

                Application.android.foregroundActivity.moveTaskToBack(true);
            }
            // if (this.shouldConfirmBack && this.currentSessionState !== SessionState.STOPPED) {
            //     data.cancel = true;
            //     const frame = Frame.topmost();
            //     confirm({
            //         title: this.$t('stop_session'),
            //         message: this.$t('stop_session_are_you_sure'),
            //         okButtonText: this.$t('close'),
            //         cancelButtonText: this.$t('cancel')
            //     })
            //         .then((result) => {
            //             if (result) {
            //                 this.shouldConfirmBack = false;
            //                 this.geoHandler.stopSession();
            //                 setTimeout(() => {
            //                     frame.android.activity.finish();
            //                 }, 10);
            //             }
            //         })
            //         .catch(this.showError);
            // }
            // this.shouldConfirmBack = true;
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
    // onTrackPositionState(event: EventData) {
    // const events: { index: number; distance?: number; trackId: string; state: 'inside' | 'leaving' | 'entering'; feature: TrackFeature }[] = event['data'].events;
    // const { feature, index, distance, state } = event['data'];
    // if (state === 'entering') {
    //     this.insideFeature = feature;
    // } else if (state === 'leaving' && this.insideFeature === feature) {
    //     this.insideFeature = null;
    // }
    // events.forEach((e) => {
    //     this.eLog(e.feature.id, e.feature.properties.name, e.state, e.distance, index);
    // });
    // }
    onTrackSelected(event: EventData) {
        const track = event['track'] as Track;
        // console.log('onTrackSelected', JSON.stringify(track));
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

    @Catch()
    async setup(handlers: BgServiceMethodParams) {
        // DEV_LOG && console.log('Map', 'setup');
        super.setup(handlers);
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandlerOn(TrackSelecteEvent, this.onTrackSelected, this);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        // this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        this.geoHandlerOn(FeatureViewedEvent, this.onFeatureViewed, this);
        // this.geoHandlerOn(InsideFeatureEvent, this.onInsideFeature, this);

        this.geoHandlerOn('error', this.onError);
        this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.onSessionStateEvent({ data: { state: handlers.geoHandler.sessionState } } as any);
        this.onNewLocation({
            error: null,
            location: handlers.geoHandler.lastLocation,
            aimingFeature: handlers.geoHandler.aimingFeature,
            aimingAngle: handlers.geoHandler.aimingAngle,
            isInTrackBounds: handlers.geoHandler.isInTrackBounds
        } as any);
        this.onTrackSelected({ track: this.geoHandler.currentTrack } as any);
        this.onFeatureViewed({ data: { featureViewed: this.geoHandler.featuresViewed } } as any);
        // this.onInsideFeature({ data: { featureViewed: this.geoHandler.featuresViewed } } as any);
        await this.geoHandler.startSession();
    }
    // onInsideFeature(event: EventData) {
    //     this.insideFeature = event['data'].feature;
    // }
    toggleSessionState() {
        if (this.currentSessionState === SessionState.PAUSED) {
            this.geoHandler.resumeSession();
        } else if (this.currentSessionState === SessionState.RUNNING) {
            this.geoHandler.pauseSession();
        }
    }
}
</script>
