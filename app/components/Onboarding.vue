<template>
    <Page :actionBarHidden="true" ref="page" @navigatingFrom="onNavigatingFrom">
        <GridLayout rows="auto,*,auto">
            <CActionBar :title="$tc('onboarding')" modal />
            <Pager row="1" ref="pager" v-model="selectedPageIndex" disableAnimation disableSwipe @swipe="onPagerSwipeEnd">
                <PagerItem>
                    <GridLayout v-show="showPage(0)" padding="10">
                        <StackLayout v-if="!bluetoothEnabled" verticalAlignment="center" horizontalAlignment="center">
                            <Label text="mdi-bluetooth-off" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <Label :text="$tc('bluetooth_not_enabled')" fontSize="16" horizontalAlignment="center" />
                            <Label :text="$tc('bluetooth_not_enabled_desc')" fontSize="14" :color="subtitleColor" horizontalAlignment="center" textAlignment="center" />
                            <MDButton :text="$tc('enable')" @tap="() => enableBluetooth()" horizontalAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="!gpsEnabled && bluetoothEnabled" verticalAlignment="center" horizontalAlignment="center">
                            <Label text="mdi-map-marker-off" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <Label :text="$tc('gps_not_enabled')" fontSize="16" horizontalAlignment="center" />
                            <Label :text="$tc('gps_not_enabled_desc')" fontSize="14" :color="subtitleColor" horizontalAlignment="center" textAlignment="center" />
                            <MDButton :text="$tc('enable')" @tap="() => enableGPS()" horizontalAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="gpsEnabled && bluetoothEnabled && !connectingToGlasses" verticalAlignment="center" horizontalAlignment="center">
                            <Image src="res://ic_logo_splash" width="50%" />
                            <Label :text="$tc('connect_glasses_desc')" fontSize="14" :color="subtitleColor" horizontalAlignment="center" />
                            <MDButton :text="$tc('connect_glasses')" @tap="() => pickGlasses()" horizontalAlignment="center" textAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="gpsEnabled && connectingToGlasses" verticalAlignment="center" horizontalAlignment="center">
                            <GridLayout width="200" height="200" verticalAlignment="center" horizontalAlignment="center">
                                <Image src="res://ic_logo_splash" width="50%" />
                                <MDActivityIndicator busy width="200" height="200" />
                            </GridLayout>
                            <Label :text="connectingGlassesText" fontSize="16" horizontalAlignment="center" textAlignment="center" />
                        </StackLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(1)" padding="10">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="auto,auto,auto,auto,auto">
                            <Label :text="$tc('test_image_see_glasses')" fontSize="20" fontWeight="bold" textAlignment="center" />

                            <Image
                                row="1"
                                ref="imageView"
                                stretch="aspectFit"
                                backgroundColor="black"
                                :colorMatrix="colorMatrix"
                                :src="configImagePath"
                                width="200"
                                height="200"
                                borderRadius="100"
                                horizontalAlignment="center"
                            />
                            <!-- <MDSlider row="3" :color="accentColor" :value="levelLuminance" @valueChange="onSliderChange('luminance', $event)" :minValue="0" :maxValue="15" verticalAlignment="center" /> -->
                            <Slider
                                id="luminance"
                                row="2"
                                margin="10 20 10 20"
                                :value="levelLuminance"
                                :minValue="0"
                                :maxValue="15"
                                @valueChange="onSliderChange('luminance', $event)"
                                icon="mdi-lightbulb-on"
                            />
                            <Label row="3" :text="$tc('adjust_glasses_luminosity')" :color="subtitleColor" fontSize="16" textAlignment="center" />
                            <MDButton row="4" :text="$tc('next')" @tap="selectedPageIndex += 1" horizontalAlignment="center" marginTop="40" />
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(2)" padding="10">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="auto,auto,auto,auto,auto,auto,auto">
                            <Label :text="$tc('place_audio_headphones')" fontSize="20" fontWeight="bold" textAlignment="center" />

                            <Label row="1" text="mdi-music" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <Label row="2" :text="$tc('play_test_desc')" fontSize="14" :color="subtitleColor" textAlignment="center" />
                            <MDButton row="3" :text="$tc('play_test')" @tap="() => playAudioTest()" horizontalAlignment="center" />
                            <Slider id="volume" row="4" margin="10 20 10 20" :value="volume" @valueChange="onSliderChange('volume', $event)" icon="mdi-volume-high" />
                            <Label row="5" :text="$tc('adjust_volume')" :color="subtitleColor" fontSize="16" textAlignment="center" />
                            <MDButton row="6" :text="forMap ? $tc('next') : $tc('finish')" @tap="onAudioDone" horizontalAlignment="center" marginTop="40" />
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(3)" padding="10">
                        <LottieView
                            v-show="watchingLocation"
                            row="1"
                            src="~/assets/images/lottie/location-not-detected.json"
                            :loop="true"
                            :autoPlay="true"
                            margin="10"
                            verticalAlignment="top"
                            horizontalAlignment="right"
                            rowSpan="7"
                            width="60"
                            height="60"
                        />
                        <Label v-show="playingInstructions" :text="$tc('playing_instructions_story')" fontSize="20" fontWeight="bold" textAlignment="center" verticalTextAlignment="center" />
                        <Label v-show="!playingInstructions" :text="$tc('searching_location_before_start')" fontSize="20" fontWeight="bold" textAlignment="center" verticalTextAlignment="center" />
                        <MDButton v-show="lastLocation" :text="$tc('start')" @tap="selectedPageIndex += 1" verticalAlignment="bottom" horizontalAlignment="center" marginTop="40" />
                    </GridLayout>
                </PagerItem>
            </Pager>
            <PageIndicator row="2" horizontalAlignment="center" :count="forMap ? 4 : 3" :selectedIndex="selectedPageIndex" marginTop="10" marginBottom="20" />
            <MDButton variant="text" v-show="!forMap || canSkip" :text="$tc('skip')" row="2" horizontalAlignment="right" verticalAlignment="bottom" @tap="onSkip" />
        </GridLayout>
    </Page>
</template>
<script lang="ts">
import { ApplicationSettings } from '@akylas/nativescript';
import { EventData } from '@nativescript-community/observable';
import { path } from '@nativescript/core/file-system';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { AvailableConfigsEvent, GlassesMemoryChangeEvent } from '~/handlers/BluetoothHandler';
import { GeoLocation, UserLocationdEventData, UserRawLocationEvent } from '~/handlers/GeoHandler';
import { ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { Catch, getVolumeLevel, setVolumeLevel } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { borderColor, mdiFontFamily, subtitleColor } from '~/variables';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import GlassesConnectionComponent from '~/components/GlassesConnectionComponent';
import PageIndicator from './PageIndicator.vue';
import Slider from './Slider.vue';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import { debounce } from 'helpful-decorators';

export enum Pages {
    BLE_GPS_GLASSES_STATE = 0,
    IMAGE_TEST = 1,
    SOUND_TEST = 2,
    FIND_LOCATION_STORY = 3,
    READY = 4
}

const TAG = '[Onboarding]';

@Component({
    components: { PageIndicator, Slider }
})
export default class Onboarding extends GlassesConnectionComponent {
    @Prop({ type: Number }) startPage: Pages;
    @Prop({ type: Boolean, default: true }) forMap: boolean;
    @Prop({ type: Boolean, default: false }) canSkip: boolean;
    colorMatrix = IMAGE_COLORMATRIX;
    selectedPageIndex: Pages = Pages.BLE_GPS_GLASSES_STATE;

    mdiFontFamily = mdiFontFamily;
    borderColor = borderColor;
    subtitleColor = subtitleColor;
    glassesMemory: FreeSpaceData = null;
    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    availableConfigs: ConfigListData = null;

    configImagePath = ApplicationSettings.getString('glasses_config_image', path.join(getGlassesImagesFolder(), 'navigation', 'start', 'VG1.png'));

    levelLuminance: number;
    lastLocation: GeoLocation = null;
    watchingLocation = false;
    playingInstructions = false;
    savedGlassesName = null;

    volume = getVolumeLevel();

    constructor() {
        super();
        this.autoConnect = true;
        DEV_LOG && console.log(TAG);
    }
    destroyed() {
        super.destroyed();
    }
    mounted() {
        super.mounted();
    }
    onNavigatingFrom() {
        console.log('onNavigatingFrom', this.watchingLocation);
        if (this.watchingLocation) {
            this.stopWatchLocation();
        }
        this.bluetoothHandler.clearFullScreen();
    }
    close() {
        this.$modal.close();
    }

    onSkip() {
        this.$modal.close(true);
    }

    get connectingGlassesText() {
        return this.$tc('connecting_glasses', this.savedGlassesName);
    }
    get showPage() {
        return (index) => {
            if (this.selectedPageIndex === index) {
                return true;
            }
            return false;
        };
    }
    setCurrentPage(page: Pages) {
        if (this.selectedPageIndex !== page) {
            this.selectedPageIndex = page;
        }
    }
    onPagerSwipeEnd() {
        // we need to animate only here or iOS would cancel the animations if started earlier
        // if (this.selectedPageIndex === Pages.STATION_ASSOCIATION) {
        //     this.startAssociatingLoadingInterval();
        // }
    }

    @Catch()
    @Watch('selectedPageIndex')
    async onSelectedTabIndex(value, oldValue) {
        console.log('onSelectedTabIndex', value, oldValue);
        switch (oldValue) {
            case Pages.IMAGE_TEST:
                this.bluetoothHandler.clearFullScreen();
                break;
        }
        switch (value) {
            case Pages.BLE_GPS_GLASSES_STATE:
                if (this.bluetoothEnabled && this.gpsEnabled) {
                    if (this.connectedGlasses) {
                        this.selectedPageIndex += 1;
                    } else {
                        this.tryToAutoConnect();
                    }
                }
                break;
            case Pages.IMAGE_TEST:
                this.bluetoothHandler.drawImageFromPathWithMire(this.configImagePath);
                break;
            case Pages.FIND_LOCATION_STORY:
                if (this.lastLocation) {
                    this.$modal.close(this.lastLocation);
                }
                this.playingInstructions = true;
                await this.geoHandler.loadAndPlayStory({ storyIndex: 1000, shouldPlayStart: false, shouldPlayRideau: false });
                this.playingInstructions = false;

                break;
        }
    }

    setup(handlers: BgServiceMethodParams) {
        DEV_LOG && console.log(TAG, 'setup');
        if (!handlers.geoHandler) {
            return;
        }
        super.setup(handlers);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.onNewLocation({
            error: null,
            location: handlers.geoHandler.lastLocation,
            aimingFeature: handlers.geoHandler.aimingFeature,
            aimingAngle: handlers.geoHandler.aimingAngle,
            isInTrackBounds: handlers.geoHandler.isInTrackBounds
        } as any);

        this.bluetoothHandlerOn(AvailableConfigsEvent, this.onAvailableConfigs, this);
        this.bluetoothHandlerOn(GlassesMemoryChangeEvent, this.onGlassesMemory);
        this.lastLocation = handlers.geoHandler.lastLocation;

        // this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.levelLuminance = handlers.bluetoothHandler.levelLuminance;
        this.savedGlassesName = handlers.bluetoothHandler.savedGlassesName;
    }
    onServiceStarted(handlers: BgServiceMethodParams) {
        console.log(TAG, 'onServiceStarted');
        super.onServiceStarted(handlers);
        if (this.connectedGlasses) {
            this.selectedPageIndex = 1;
        }
        if (!this.lastLocation) {
            this.startWatchLocation();
        }
    }
    onGlassesMemory(e: { data: FreeSpaceData }) {
        this.glassesMemory = e.data;
    }

    onGlassesConnected(data) {
        super.onGlassesConnected(data);
        this.savedGlassesName = this.bluetoothHandler.savedGlassesName;
        if (this.selectedPageIndex === 0) {
            this.selectedPageIndex = 1;
        }
        if (!this.lastLocation) {
            this.startWatchLocation();
        }
    }

    onGlassesDisconnected(data) {
        super.onGlassesDisconnected(data);
        this.selectedPageIndex = 0;
    }

    async onNewLocation(data: UserLocationdEventData) {
        if (data.error) {
            this.showError(data.error);
            return;
        }
        if (data.location) {
            this.lastLocation = data.location;
            this.stopWatchLocation();
        }
        if (this.selectedPageIndex === Pages.FIND_LOCATION_STORY) {
            this.$modal.close(this.lastLocation);
        }
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
    onAvailableConfigs(event: EventData) {
        this.availableConfigs = event['data'];
    }

    @Catch()
    async enableBluetooth() {
        await this.bluetoothHandler.enable();
    }

    @Catch()
    async enableGPS() {
        await this.geoHandler.enableLocation();
    }

    showConfigImage() {
        this.bluetoothHandler.drawImageFromPathWithMire(this.configImagePath);
    }
    @debounce(300)
    updateLuminance(value) {
        this.bluetoothHandler.changeLuminance(value);
    }

    onAudioDone() {
        if (this.forMap) {
            this.selectedPageIndex++;
        } else {
            this.$modal.close();
        }
    }

    onSliderChange(id: string, args) {
        const value = Math.round(args.value);
        switch (id) {
            case 'luminance':
                this.updateLuminance(value);
                break;
            case 'volume':
                setVolumeLevel(value);
                break;
        }
    }
    @Catch()
    async playAudioTest() {
        const instFolder = path.join(getGlassesImagesFolder(), 'navigation/uturn', 'pas.mp3');
        await this.bluetoothHandler.playAudio({ fileName: instFolder });
    }
    async startWatchLocation() {
        if (this.watchingLocation || !this.geoHandler) {
            return;
        }
        await this.geoHandler.enableLocation();
        await this.geoHandler.startWatch();
        this.watchingLocation = true;
    }
    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        this.watchingLocation = false;
    }
}
</script>
