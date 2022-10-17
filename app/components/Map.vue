<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatingTo="onNavigatingTo" @navigatingFrom="onNavigatingFrom">
        <GridLayout>
            <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton :tracks="selectedTracks" :viewedFeature="viewedFeatures" />
            <GlassesIcon :glasses="connectedGlasses" :battery="glassesBattery" verticalAlignment="top" horizontalAlignment="right" />

            <MDButton horizontalAlignment="center" verticalAlignment="bottom" class="playerButton" :text="sessionPaused ? 'mdi-play' : 'mdi-pause'" @tap="toggleSessionState" />
            <GridLayout v-if="devMode">
                <Label horizontalAlignment="left" color="blue" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentBearing" padding="10" />
                <Label horizontalAlignment="center" color="black" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="aimingAngle" padding="10" />
                <Label horizontalAlignment="right" color="red" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentComputedBearing" padding="10" />
                <CanvasLabel
                    backgroundColor="rgba(0, 0, 0, 0.533)"
                    v-if="lastLocation"
                    width="50%"
                    height="100"
                    borderRadius="10"
                    marginTop="50"
                    padding="4"
                    fontSize="11"
                    color="white"
                    horizontalAlignment="center"
                    verticalAlignment="top"
                >
                    <CSpan text="position:" />
                    <CSpan :text="`${lastLocation.lat.toFixed(4)},${this.lastLocation.lon.toFixed(4)}`" textAlignment="right" />
                    <CSpan text="horizontalAccuracy:" paddingTop="13" />
                    <CSpan :text="`${lastLocation.horizontalAccuracy.toFixed()}m`" textAlignment="right" paddingTop="13" />
                    <CSpan text="bearing:" paddingTop="26" />
                    <CSpan :text="`${(lastLocation.bearing !== undefined ? lastLocation.bearing : -1).toFixed()}°`" textAlignment="right" paddingTop="26" />
                    <CSpan text="computedBearing:" paddingTop="39" />
                    <CSpan :text="`${(lastLocation.computedBearing !== undefined ? lastLocation.computedBearing : -1).toFixed()}°`" textAlignment="right" paddingTop="39" />
                    <CSpan text="provider:" paddingTop="52" />
                    <CSpan :text="lastLocation.provider" textAlignment="right" paddingTop="52" />
                    <CSpan text="speed:" paddingTop="65" />
                    <CSpan :text="`${lastLocation.hasOwnProperty('speed') ? lastLocation.speed.toFixed() : '-'}m/s`" textAlignment="right" paddingTop="65" />
                    <CSpan text="time:" paddingTop="78" />
                    <CSpan :text="lastLocation.timestamp | date('L LTS')" textAlignment="right" paddingTop="78" />
                </CanvasLabel>
            </GridLayout>
            <GridLayout :backgroundColor="backgroundColor" v-show="showStartText" row="1" margin="20" padding="20" borderRadius="30" verticalAlignment="center" rows="auto,auto">
                <Label textAlignment="center" fontSize="20">
                    <SPan :text="$tc('all_good_title')" fontWeight="bold" />
                    <SPan :text="'\n\n' + $tc('all_good_desc')" />
                </Label>
                <MDButton row="1" marginTop="20" :text="$tc('lets_go')" @tap="showStartText = false" horizontalAlignment="center" />
            </GridLayout>
        </GridLayout>
    </Page>
</template>
<script lang="ts">
import { EventData } from '@akylas/nativescript';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { AndroidApplication, Application, Frame } from '@nativescript/core';
import { AndroidActivityBackPressedEventData } from '@nativescript/core/application';
import dayjs from 'dayjs';
import { Component } from 'vue-property-decorator';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import GlassesIcon from '~/components/GlassesIcon.vue';
import { GeoLocation, SessionEventData, SessionState, SessionStateEvent, UserRawLocationEvent } from '~/handlers/GeoHandler';
import { FeatureViewedEvent, TrackSelecteEvent, UserLocationdEventData } from '~/handlers/StoryHandler';
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

    public debug = false;
    aimingAngle: number = 0;

    get mapComp() {
        return this.$refs.mapComp as MapComponent;
    }
    get map() {
        return this.mapComp?.cartoMap;
    }
    get sessionPaused() {
        return this.currentSessionState === SessionState.PAUSED;
    }
    get devMode() {
        return this.$getDevMode();
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

    get lastLocationDetails() {
        return this.lastLocation
            ? `position:				${this.lastLocation.lat.toFixed(4)},${this.lastLocation.lon.toFixed(4)}
horizontalAccuracy:		${this.lastLocation.horizontalAccuracy.toFixed()}m
bearing:				${(this.lastLocation.bearing ?? -1).toFixed()}°
computedBearing:		${(this.lastLocation.computedBearing ?? -1).toFixed()}°
provider:				${this.lastLocation.provider} 
speed:					${this.lastLocation.hasOwnProperty('speed') ? this.lastLocation.speed.toFixed() : '-'}m/s
time:					${dayjs(this.lastLocation.timestamp).format('L LTS')}`
            : null;
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
        if (this.mapComp) {
            this.mapComp.userFollow = true;
        }
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
    onTrackSelected(event: EventData, fitBounds = true) {
        const track = event['track'] as Track;
        if (track === this.selectedTrack) {
            return;
        }
        DEV_LOG && console.log('onTrackSelected', track.name, fitBounds);
        this.selectedTrack = track;
        this.selectedTracks = [track];
        const map = this.map;
        if (fitBounds && track && map) {
            map.moveToFitBounds(track.bounds, undefined, true, true, false, 200);
        }
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

    @Catch()
    async setup(handlers: BgServiceMethodParams) {
        DEV_LOG && console.log('Map', 'setup');
        super.setup(handlers);
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.storyHandlerOn(TrackSelecteEvent, this.onTrackSelected, this);
        // this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        this.storyHandlerOn(FeatureViewedEvent, this.onFeatureViewed, this);
        // this.geoHandlerOn(InsideFeatureEvent, this.onInsideFeature, this);

        this.geoHandlerOn('error', this.onError);
        this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.onSessionStateEvent({ data: { state: handlers.geoHandler.sessionState } } as any);
        this.onNewLocation({
            error: null,
            location: handlers.storyHandler.lastLocation,
            aimingFeature: handlers.storyHandler.aimingFeature,
            aimingAngle: handlers.storyHandler.aimingAngle,
            isInTrackBounds: handlers.storyHandler.isInTrackBounds
        } as any);
        this.onTrackSelected({ track: this.storyHandler.currentTrack } as any, false);
        this.onFeatureViewed({ data: { featureViewed: this.storyHandler.featuresViewed } } as any);
        // this.onInsideFeature({ data: { featureViewed: this.geoHandler.featuresViewed } } as any);
        // await this.geoHandler.startSession();
    }

    async onServiceStarted(handlers: BgServiceMethodParams) {
        super.onServiceStarted(handlers);
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
