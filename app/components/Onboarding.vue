<template>
    <Page id="onboarding" :actionBarHidden="true" ref="page" @navigatingFrom="onNavigatingFrom" @closingModally="onNavigatingFrom" :keepScreenAwake="true">
        <GridLayout rows="auto,*,auto">
            <CActionBar :title="$tc('onboarding')" textAlignment="center" modal :goBack="close" />
            <Pager row="1" ref="pager" v-model="selectedPageIndex" disableAnimation disableSwipe @swipe="onPagerSwipeEnd">
                <PagerItem>
                    <GridLayout v-show="showPage(0)" padding="10 10 10 10">
                        <GridLayout v-if="!bluetoothEnabled" rows="*,*,auto">
                            <Label text="mdi-bluetooth-off" class="mdi" fontSize="140" textAlignment="center" verticalAlignment="bottom" marginBottom="40" />
                            <Label row="1" textAlignment="center" width="70%" fontSize="19">
                                <Span :text="$tc('bluetooth_not_enabled')" fontSize="24" />
                                <Span :text="'\n\n' + $tc('bluetooth_not_enabled_desc')" fontSize="20" />
                            </Label>
                            <MDButton row="2" variant="outline" :text="$tc('enable')" @tap="() => enableBluetooth()" horizontalAlignment="center" marginBottom="40" />
                        </GridLayout>
                        <GridLayout v-if="!gpsEnabled && bluetoothEnabled" rows="*,*,auto">
                            <Label text="mdi-map-marker-off" class="mdi" fontSize="140" textAlignment="center" verticalAlignment="bottom" marginBottom="40" />
                            <Label row="1" textAlignment="center" width="70%" fontSize="19">
                                <Span :text="$tc('gps_not_enabled')" fontSize="24" />
                                <Span :text="'\n\n' + $tc('gps_not_enabled_desc')" fontSize="20" />
                            </Label>
                            <MDButton row="2" variant="outline" :text="$tc('enable')" @tap="() => enableGPS()" horizontalAlignment="center" marginBottom="40" />
                        </GridLayout>

                        <GridLayout v-if="gpsEnabled && bluetoothEnabled" rows="*,*,auto">
                            <Image :src="connectingToGlasses ? 'res://glasses' : 'res://glasses_2'" width="80%" verticalAlignment="bottom" />
                            <Label
                                row="1"
                                :html="connectingToGlasses ? connectingGlassesText : $tc('connect_glasses_desc')"
                                fontSize="19"
                                textAlignment="center"
                                verticalAlignment="center"
                                width="70%"
                            />
                            <Label row="1" textAlignment="center" verticalAlignment="center">
                                <Span text="" fontSize="24" />
                                <Span text="" fontSize="20" />
                            </Label>
                            <MDButton
                                :visibility="connectingToGlasses ? 'hidden' : 'visible'"
                                row="2"
                                variant="outline"
                                :text="$tc('connect_glasses')"
                                @tap="() => pickGlasses()"
                                @longPress="onGlassesBtnLongPress"
                                horizontalAlignment="center"
                                textAlignment="center"
                            />
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(1)" padding="10" rows="*,*,auto">
                        <Image src="res://head_glasses" width="80%" verticalAlignment="bottom" />
                        <Label row="1" :text="$tc('install_glasses_desc')" fontSize="19" textAlignment="center" verticalAlignment="center" width="70%" />
                        <MDButton row="2" variant="outline" :text="$tc('glasses_installed')" @tap="selectedPageIndex += 1" horizontalAlignment="center" textAlignment="center" />
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(2)" padding="10" rows="*,*,auto">
                        <Image src="res://head_headphones" width="80%" verticalAlignment="bottom" />
                        <Label row="1" :text="$tc('install_headphones_desc')" fontSize="19" textAlignment="center" verticalAlignment="center" width="70%" />
                        <MDButton row="2" variant="outline" :text="$tc('headphones_installed')" @tap="selectedPageIndex += 1" horizontalAlignment="center" textAlignment="center" />
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(3)" padding="10">
                        <GridLayout verticalAlignment="center" horizontalAlignment="center" rows="*,auto,auto,auto,auto">
                            <GridLayout row="0" horizontalAlignment="center" rows="*" columns="auto" backgroundColor="black" borderRadius="20" margin="20">
                                <Image stretch="aspectFit" :colorMatrix="colorMatrix" :src="configImagePath" borderRadius="20" margin="20" />
                                <CanvasView @draw="onDraw" />
                            </GridLayout>

                            <Label row="1" :html="$tc('test_image_see_glasses')" fontSize="20" textAlignment="center" width="90%" />
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
                            <Label row="3" :text="$tc('adjust_glasses_luminosity')" fontSize="19" textAlignment="center" width="70%" />
                            <MDButton variant="outline" row="4" :text="$tc('luminance_ok')" @tap="selectedPageIndex += 1" horizontalAlignment="center" />
                        </GridLayout>
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(4)" padding="10" rows="auto,*,auto,auto,auto,auto,auto">
                        <Label :text="$tc('place_audio_headphones')" fontSize="20" fontWeight="bold" textAlignment="center" />

                        <Label
                            row="1"
                            text="mdi-music"
                            class="mdi"
                            fontSize="140"
                            textAlignment="center"
                            marginTop="20"
                            marginBottom="20"
                            :autoFontSize="true"
                            maxFontSize="140"
                            verticalTextAlignment="center"
                        />
                        <Label row="2" :text="$tc('play_test_desc')" fontSize="20" textAlignment="center" width="70%" />
                        <MDButton variant="outline" row="3" :text="$tc('play_test')" @tap="() => playAudioTest()" horizontalAlignment="center" />
                        <Slider id="volume" row="4" margin="10 20 10 20" :value="volume" @valueChange="onSliderChange('volume', $event)" icon="mdi-volume-high" />
                        <Label row="5" :text="$tc('adjust_volume')" fontSize="16" textAlignment="center" width="70%" />
                        <MDButton variant="outline" row="6" :text="forMap ? $tc('start_demo') : $tc('next')" @tap="onAudioDone" horizontalAlignment="center" />
                    </GridLayout>
                </PagerItem>
                <PagerItem>
                    <GridLayout v-show="showPage(5)" padding="10" rows="*,*,auto">
                        <LottieView
                            v-show="watchingLocation"
                            row="0"
                            src="~/assets/images/lottie/location-not-detected.json"
                            :loop="true"
                            :autoPlay="true"
                            margin="40"
                            verticalAlignment="top"
                            horizontalAlignment="center"
                        />
                        <Label row="1" v-show="playingInstructions" :text="$tc('playing_instructions_story')" fontSize="20" fontWeight="bold" textAlignment="center" verticalTextAlignment="center" />
                        <Label
                            row="1"
                            v-show="!playingInstructions"
                            :text="$tc('searching_location_before_start')"
                            fontSize="20"
                            fontWeight="bold"
                            textAlignment="center"
                            verticalTextAlignment="center"
                        />
                        <MDButton row="2" variant="outline" :text="$tc('wait') + '...'" horizontalAlignment="center" @longPress="onSkip" />
                    </GridLayout>
                </PagerItem>
            </Pager>
            <MDButton
                row="2"
                horizontalAlignment="left"
                verticalAlignment="center"
                :visibility="canGoBack ? 'visible' : 'hidden'"
                variant="text"
                class="actionBarButton"
                text="mdi-chevron-left"
                marginLeft="10"
                @tap="onGoBack"
            />
            <PageIndicator row="2" horizontalAlignment="center" :count="forMap ? 6 : 5" :selectedIndex="selectedPageIndex" verticalAlignment="center" />
            <MDButton variant="text" v-show="showSkipButton" :text="$tc('skip')" row="2" horizontalAlignment="right" verticalAlignment="bottom" @tap="onSkip" margin="5" :color="textColor" />
        </GridLayout>
    </Page>
</template>
<script lang="ts">
import { ApplicationSettings } from '@akylas/nativescript';
import { EventData } from '@nativescript-community/observable';
import { Canvas, Paint } from '@nativescript-community/ui-canvas';
import { knownFolders, path } from '@nativescript/core/file-system';
import { throttle } from 'helpful-decorators';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { BgServiceMethodParams } from '~/components/BgServiceComponent';
import { AvailableConfigsEvent, GlassesMemoryChangeEvent } from '~/handlers/BluetoothHandler';
import { GeoLocation, UserRawLocationEvent } from '~/handlers/GeoHandler';
import { ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { UserLocationdEventData } from '~/handlers/StoryHandler';
import { Catch, getVolumeLevel, setVolumeLevel, versionCompare } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { borderColor, mdiFontFamily, subtitleColor, textColor } from '~/variables';
import { GLASSES_COLOR, IMAGE_COLORMATRIX } from '~/vue.views';
import FirmwareUpdateComponent from './FirmwareUpdateComponent';
import PageIndicator from './PageIndicator.vue';
import Slider from './Slider.vue';

export enum Pages {
    BLE_GPS_GLASSES_STATE = 0,
    PUT_GLASSES = 1,
    PUT_HEADPHONES = 2,
    IMAGE_TEST = 3,
    SOUND_TEST = 4,
    FIND_LOCATION_STORY = 5
}

const TAG = '[Onboarding]';
const glassesPaint = new Paint();
glassesPaint.setColor(GLASSES_COLOR);

@Component({
    components: { PageIndicator, Slider }
})
export default class Onboarding extends FirmwareUpdateComponent {
    @Prop({ type: Number }) startPage: Pages;
    @Prop({ type: Boolean, default: true }) forMap: boolean;
    @Prop({ type: Boolean, default: false }) canSkip: boolean;
    colorMatrix = IMAGE_COLORMATRIX;
    selectedPageIndex: Pages = Pages.BLE_GPS_GLASSES_STATE;

    mdiFontFamily = mdiFontFamily;
    borderColor = borderColor;
    textColor = textColor;
    subtitleColor = subtitleColor;
    glassesMemory: FreeSpaceData = null;
    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);
    availableConfigs: ConfigListData = null;

    configImagePath = ApplicationSettings.getString('glasses_config_image', path.join(getGlassesImagesFolder(), 'navigation', 'start', 'VG1.jpg'));

    levelLuminance: number = 0;
    lastLocation: GeoLocation = null;
    watchingLocation = false;
    playingInstructions = false;

    volume = getVolumeLevel();

    constructor() {
        super();
        this.autoConnect = true;
    }
    destroyed() {
        super.destroyed();
    }
    mounted() {
        super.mounted();
    }
    onNavigatingFrom() {
        if (this.watchingLocation) {
            this.stopWatchLocation();
        }
        this.bluetoothHandler.clearFullScreen();
    }
    close() {
        this.$modal.close();
    }

    get canGoBack() {
        return this.selectedPageIndex >= Pages.PUT_HEADPHONES && this.selectedPageIndex < Pages.FIND_LOCATION_STORY;
    }
    onGoBack() {
        if (!this.connectedGlasses && this.selectedPageIndex === Pages.SOUND_TEST) {
            this.selectedPageIndex = Pages.BLE_GPS_GLASSES_STATE;
        } else {
            this.selectedPageIndex -= 1;
        }
    }

    get canActualSip() {
        return this.canSkip || (!this.connectingToGlasses && this.selectedPageIndex === Pages.BLE_GPS_GLASSES_STATE);
    }
    get showSkipButton() {
        return this.canSkip;
    }

    onGlassesBtnLongPress(e) {
        if (__IOS__ && e?.ios?.state !== 3) {
            return;
        }
        if (this.canActualSip) {
            this.onSkip(e);
        }
    }

    onSkip(e) {
        if (this.selectedPageIndex === Pages.BLE_GPS_GLASSES_STATE) {
            this.selectedPageIndex = Pages.SOUND_TEST;
        } else {
            this.$modal.close(true);
        }
    }

    get connectingGlassesText() {
        return this.$tc('connecting_glasses', this.glassesName);
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
                this.storyHandler.drawImageFromPathWithMire(this.configImagePath);
                break;
            case Pages.FIND_LOCATION_STORY:
                if (this.lastLocation) {
                    this.$modal.close(this.lastLocation);
                }
                this.playingInstructions = true;
                await this.storyHandler.loadAndPlayStory({ storyIndex: 1000, shouldPlayStart: false, shouldPlayRideau: false, canStop: true, markAsPlayedOnMap: false });
                this.playingInstructions = false;

                break;
        }
    }

    setCurrentLocation(location: GeoLocation) {
        DEV_LOG && console.log(TAG, 'setCurrentLocation', location, location && Date.now() - location.timestamp < 600000);
        if (!this.lastLocation && location && location.horizontalAccuracy < 10 && Date.now() - location.timestamp < 600000) {
            this.lastLocation = location;

            if (this.selectedPageIndex === Pages.FIND_LOCATION_STORY) {
                this.$modal.close(this.lastLocation);
            }
        }
    }

    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        super.setup(handlers);
        this.geoHandlerOn(UserRawLocationEvent, this.onNewLocation, this);
        this.onNewLocation({
            error: null,
            location: handlers.storyHandler.lastLocation,
            aimingFeature: handlers.storyHandler.aimingFeature,
            aimingAngle: handlers.storyHandler.aimingAngle,
            isInTrackBounds: handlers.storyHandler.isInTrackBounds
        } as any);

        this.bluetoothHandlerOn(AvailableConfigsEvent, this.onAvailableConfigs, this);
        this.bluetoothHandlerOn(GlassesMemoryChangeEvent, this.onGlassesMemory);

        // this.isWatchingLocation = handlers.geoHandler.isWatching();
        this.levelLuminance = handlers.bluetoothHandler.levelLuminance;
    }
    onServiceStarted(handlers: BgServiceMethodParams) {
        super.onServiceStarted(handlers);
        if (this.connectedGlasses) {
            this.selectedPageIndex = 1;
        }
        if (this.forMap && !this.lastLocation) {
            this.startWatchLocation();
        }
    }
    onGlassesMemory(e: { data: FreeSpaceData }) {
        this.glassesMemory = e.data;
    }

    onGlassesConnected(e) {
        const changed = this.connectedGlasses !== e.data;
        super.onGlassesConnected(e);

        if (this.selectedPageIndex === 0) {
            this.selectedPageIndex = 1;
        }
        if (changed) {
            setTimeout(() => {
                // the timeout is to ensure we are visible before showing the loading progress dialog
                this.checkAndUpdateFirmware();
            }, 1000);
        }
        if (this.forMap && !this.lastLocation) {
            this.startWatchLocation();
        }
    }

    onGlassesDisconnected(data) {
        super.onGlassesDisconnected(data);
        this.selectedPageIndex = 0;
    }
    onFirmwareUpdateProgress(progress: number) {
        this.currentProgress = progress;
        this.updateLoadingProgress({
            progress
        });
    }

    async onNewLocation(data: UserLocationdEventData) {
        DEV_LOG && console.log('onNewLocation', data.location, data.error);
        if (data.error) {
            this.showError(data.error);
            return;
        }
        if (data.location && !this.lastLocation) {
            this.setCurrentLocation(data.location);
        }
        if (this.lastLocation) {
            this.stopWatchLocation();
        }
    }
    async startMapSession() {
        DEV_LOG && console.log(TAG, 'startMapSession', new Error().stack);
        // const lastLocation = await this.$showModal((await import('~/components/Onboarding.vue')).default, { fullscreen: true, props: { canSkip: !PRODUCTION } });
        // if (this.forMap) {
        //     const component = await import('~/components/Map.vue');
        //     this.$navigateTo(component.default, {
        //         clearHistory: true
        //     });
        // } else {
        //     const component = await import('~/components/StillAdventure.vue');
        //     this.$navigateTo(component.default, {
        //         clearHistory: true
        //     });
        // }
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
    async checkAndUpdateFirmware() {
        DEV_LOG &&
            console.log(
                'checkAndUpdateFirmware',
                this.connectedGlasses?.versions,
                this.connectedGlasses?.versions && this.connectedGlasses?.versions?.firmware && versionCompare('4.6.0', this.connectedGlasses?.versions?.firmware)
            );
        if (this.connectedGlasses?.versions && this.connectedGlasses?.versions?.firmware && versionCompare('4.6.0', this.connectedGlasses?.versions?.firmware) > 0) {
            // we need to update the firmware
            this.showLoading({ title: this.$tc('updating_firmware'), progress: 0 } as any);
            await this.updateFirmware(path.join(knownFolders.currentApp().path, 'assets/data/4.6.0.img'));
        }
    }

    @Catch()
    async enableBluetooth() {
        this.bluetoothEnabled = await this.bluetoothHandler.enable();
    }

    @Catch()
    async enableGPS() {
        await this.geoHandler.enableLocation();
    }

    showConfigImage() {
        this.storyHandler.drawImageFromPathWithMire(this.configImagePath);
    }
    @throttle(50)
    updateLuminance(value) {
        this.bluetoothHandler.changeLuminance(value);
    }

    onAudioDone() {
        if (this.forMap) {
            this.selectedPageIndex++;
        } else {
            this.$modal.close(true);
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
        await this.storyHandler.playAudio({ fileName: instFolder });
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

    onDraw(event) {
        const canvas = event.canvas as Canvas;
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        glassesPaint.setColor(GLASSES_COLOR);
        const radius = 2;
        const offset = 14;
        canvas.drawCircle(offset, offset, radius, glassesPaint);
        canvas.drawCircle(w - offset, offset, radius, glassesPaint);
        canvas.drawCircle(w - offset, h - offset, radius, glassesPaint);
        canvas.drawCircle(offset, h - offset, radius, glassesPaint);
    }
}
</script>
