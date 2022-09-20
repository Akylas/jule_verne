<template>
    <Page :actionBarHidden="true" ref="page" @navigatingFrom="onNavigatingFrom">
        <GridLayout rows="auto,*,auto">
            <CActionBar title="" />
            <Pager row="1" ref="pager" v-model="selectedPageIndex" :disableSwipe="true" @swipe="onPagerSwipeEnd">
                <PagerItem>
                    <GridLayout v-show="showPage(0)">
                        <StackLayout v-if="!bluetoothEnabled" verticalAlignment="center" horizontalAlignment="center">
                            <Label text="mdi-bluetooth-off" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <Label :text="$tc('bluetooth_not_enabled')" fontSize="16" horizontalAlignment="center" />
                            <MDButton :text="$tc('enable')" @tap="() => enableBluetooth()" horizontalAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="!gpsEnabled && bluetoothEnabled" verticalAlignment="center" horizontalAlignment="center">
                            <Label text="mdi-map-marker-off" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <Label :text="$tc('gps_not_enabled')" fontSize="16" horizontalAlignment="center" />
                            <MDButton :text="$tc('enable')" @tap="() => enableBluetooth()" horizontalAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="gpsEnabled && bluetoothEnabled && !connectingToGlasses" verticalAlignment="center" horizontalAlignment="center">
                            <Image src="res://ic_logo_splash" width="50%" />
                            <MDButton :text="$tc('connect_glasses')" @tap="() => pickGlasses()" horizontalAlignment="center" />
                        </StackLayout>
                        <StackLayout v-if="connectingToGlasses" verticalAlignment="center" horizontalAlignment="center">
                            <GridLayout width="200" height="200" verticalAlignment="center" horizontalAlignment="center">
                                <Image src="res://ic_logo_splash" width="50%" />
                                <MDActivityIndicator busy width="200" height="200" />
                            </GridLayout>
                            <Label :text="connectingGlassesText" fontSize="16" horizontalAlignment="center" />
                        </StackLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(1)">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="auto,auto,auto,auto,auto">
                            <Label :text="$tc('test_image_see_glasses')" fontSize="20" fontWeight="bold" textAlignment="center" />

                            <Image row="1" ref="imageView" stretch="aspectFit" backgroundColor="black" :colorMatrix="colorMatrix" :src="configImagePath" width="50%" />
                            <Label row="2" :text="$tc('adjust_glasses_luminosity')" fontSize="16" textAlignment="center" />
                            <MDSlider row="3" :color="accentColor" :value="levelLuminance" @valueChange="onSliderChange('luminance', $event)" :minValue="0" :maxValue="15" verticalAlignment="center" />
                            <MDButton row="4" :text="$tc('next')" @tap="selectedPageIndex += 1" horizontalAlignment="center" marginTop="40"/>
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(2)">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="auto,auto,auto,auto">
                            <Label :text="$tc('place_audio_headphones')" fontSize="20" fontWeight="bold" textAlignment="center" />

                            <Label row="1" text="mdi-music" class="mdi" fontSize="40" horizontalAlignment="center" />
                            <MDButton row="2" :text="$tc('play_test')" @tap="() => playAudioTest()" horizontalAlignment="center" />
                            <MDButton row="3" :text="$tc('next')" @tap="selectedPageIndex += 1" horizontalAlignment="center" marginTop="40"/>
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(3)">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="auto,auto,auto,auto">
                            <LottieView
                                v-show="watchingLocation"
                                row="1"
                                src="~/assets/images/lottie/location-not-detected.json"
                                :loop="true"
                                :autoPlay="true"
                                margin="10"
                                verticalAlignment="bottom"
                                horizontalAlignment="left"
                                rowSpan="7"
                                width="60"
                                height="60"
                            />
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
            </Pager>
            <PageIndicator row="2" horizontalAlignment="center" :count="5" :selectedIndex="selectedPageIndex" marginTop="10" marginBottom="20" />
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
import { Catch } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { borderColor, mdiFontFamily } from '~/variables';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import GlassesConnectionComponent from '~/components/GlassesConnectionComponent';
import PageIndicator from './PageIndicator.vue';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import { debounce } from 'helpful-decorators';

export enum Pages {
    BLE_GPS_GLASSES_STATE = 0,
    IMAGE_TEST = 1,
    SOUND_TEST = 2,
    FIND_LOCATION = 3,
    READY = 4
}

const TAG = '[Onboarding]';

@Component({
    components: { PageIndicator }
})
export default class Onboarding extends GlassesConnectionComponent {
    @Prop({ type: Number }) startPage: Pages;
    @Prop({ type: Boolean, default: true }) forMap: boolean;
    colorMatrix = IMAGE_COLORMATRIX;
    selectedPageIndex: Pages = Pages.BLE_GPS_GLASSES_STATE;

    mdiFontFamily = mdiFontFamily;
    borderColor = borderColor;
    // isWatchingLocation = false;
    public lastLocation: GeoLocation = null;
    glassesMemory: FreeSpaceData = null;
    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    availableConfigs: ConfigListData = null;

    configImagePath = ApplicationSettings.getString('glasses_config_image', path.join(getGlassesImagesFolder(), 'navigation', 'start', 'VG1.png'));

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
        this.bluetoothHandler.clearFullScreen();
    }

    get connectingGlassesText() {
        return this.$tc('connecting_glasses', this.bluetoothHandler.savedGlassesName);
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
            case Pages.FIND_LOCATION:
                this.bluetoothHandler.playStory(0, false);
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
        if (!this.lastLocation) {
            this.startWatchLocation();
        }
        // this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.levelLuminance = handlers.bluetoothHandler.levelLuminance;
        DEV_LOG && console.log(TAG, 'setup', !!this.connectedGlasses);
        if (this.connectedGlasses) {
            this.selectedPageIndex = 1;
        }
    }
    onGlassesMemory(e: { data: FreeSpaceData }) {
        this.glassesMemory = e.data;
    }

    onGlassesConnected(data) {
        super.onGlassesConnected(data);
        this.selectedPageIndex = 1;
    }

    onGlassesDisconnected(data) {
        super.onGlassesDisconnected(data);
        this.selectedPageIndex = 0;
    }

    onNewLocation(data: UserLocationdEventData) {
        if (data.error) {
            this.showError(data.error);
            return;
        }
        this.lastLocation = data.location;
        this.stopWatchLocation();
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
    levelLuminance: number;
    @debounce(300)
    updateLuminance(value) {
        this.bluetoothHandler.changeLuminance(value);
    }
    onSliderChange(id: string, args) {
        const slider = args.object;
        const value = Math.round(slider.value);
        switch (id) {
            case 'luminance':
                this.updateLuminance(value);
                break;
        }
    }
    @Catch()
    async playAudioTest() {
        const instFolder = path.join(getGlassesImagesFolder(), 'navigation/uturn', 'pas.mp3');
        await this.bluetoothHandler.playAudio({ fileName: instFolder });
    }
    watchingLocation = false;
    async startWatchLocation() {
        if (this.watchingLocation || !this.geoHandler) {
            return;
        }
        await this.geoHandler.enableLocation();
        await this.geoHandler.startWatch();
    }
    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        this.watchingLocation = false;
    }
}
</script>
