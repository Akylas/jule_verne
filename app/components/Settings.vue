<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <StackLayout>
            <CActionBar :title="$t('settings')" showMenuIcon />
            <CollectionView :items="items">
                <v-template if="item.type === 'shift'">
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                        <Label>
                            <Span padding="5 0 5 0" fontSize="15" lineHeight="30" :text="item.title | uppercase" />
                            <Span fontSize="13" :text="item.description ? '\n' + item.description : ''" />
                        </Label>
                        <GridLayout padding="20" row="2" horizontalAlignment="center" verticalAlignment="center" rows="45,120,45" columns="45,150,45">
                            <MDButton row="1" class="settings-shift-button" :text="'mdi-arrow-left-bold-circle'" @tap="shift(1, 0)" @touch="onShiftTouch($event, 1, 0)" />
                            <MDButton row="1" col="2" class="settings-shift-button" :text="'mdi-arrow-right-bold-circle'" @tap="shift(-1, 0)" @touch="onShiftTouch($event, -1, 0)" />
                            <MDButton row="0" col="1" class="settings-shift-button" :text="'mdi-arrow-up-bold-circle'" @tap="shift(0, 1)" @touch="onShiftTouch($event, 0, 1)" />
                            <MDButton row="2" col="1" class="settings-shift-button" :text="'mdi-arrow-down-bold-circle'" @tap="shift(0, -1)" @touch="onShiftTouch($event, 0, -1)" />
                            <GridLayout row="1" col="1" borderWidth="2" rows="10,*,10" columns="10,*,10" :borderColor="accentColor">
                                <StackLayout row="1" col="1" :backgroundColor="accentColor" opacity="0.3" />
                                <StackLayout
                                    row="1"
                                    col="1"
                                    orientation="horizontal"
                                    borderWidth="2"
                                    :borderColor="accentColor"
                                    backgroundColor="transparent"
                                    :translateX="item.currentShift ? -item.currentShift.x / 2 : 0"
                                    :translateY="item.currentShift ? -item.currentShift.y / 2 : 0"
                                >
                                    <Label
                                        padding="10"
                                        :color="accentColor"
                                        :text="$t('screen_offset')"
                                        fontSize="20"
                                        fontWeight="bold"
                                        textWrap
                                        horizontalAlignment="center"
                                        textAlignment="center"
                                        verticalAlignment="center"
                                        @tap="onButtonTap('drawTestImage')"
                                    />
                                </StackLayout>
                            </GridLayout>
                        </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'config'">
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto">
                        <Label padding="5 0 5 0">
                            <Span fontSize="15" :text="(item.name + '\n') | uppercase" />
                            <Span fontSize="13" :text="item.size | filesize" />
                        </Label>
                        <MDButton col="1" v-show="!item.isSystem" variant="text" class="icon-btn" text="mdi-delete" @tap="onButtonTap('deleteCfg', item, $event)" />
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'switch'">
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto">
                        <Label>
                            <Span padding="5 0 5 0" fontSize="15" :text="item.title | uppercase" />
                            <Span fontSize="13" :text="item.subtitle ? '\n' + item.subtitle : ''" />
                        </Label>
                        <Switch :ios:backgroundColor="accentColor" :checked="item.checked" @checkedChange="onCheckedChange(item, $event)" col="1" verticalAlignment="center" />
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'header'">
                    <GridLayout columns="*,auto">
                        <Label class="settings-header" :text="item.title | uppercase" />
                        <MDButton variant="text" col="1" v-show="item.buttonTitle" :text="item.buttonTitle" @tap="onButtonTap(item.id, item, $event)" :color="accentColor" :rippleColor="accentColor" />
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'button'">
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto">
                        <Label>
                            <Span padding="5 0 5 0" fontSize="15" :text="item.title | uppercase" />
                            <Span fontSize="13" :text="item.subtitle ? '\n' + item.subtitle : ''" />
                        </Label>
                        <MDButton variant="text" col="1" :text="item.buttonTitle" @tap="onButtonTap(item.id, item, $event)" :color="accentColor" :rippleColor="accentColor" />
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'slider'">
                    <GridLayout class="settings-section settings-section-holder" columns="auto,*,auto" rows="auto,auto,auto">
                        <Label colSpan="2">
                            <Span padding="5 0 5 0" fontSize="15" :text="item.title | uppercase" />
                            <Span fontSize="13" :text="item.subtitle ? '\n' + item.subtitle : ''" />
                        </Label>
                        <Label row="2" :text="item.min + ''" verticalAlignment="center" />
                        <Label row="2" col="2" :text="item.max + ''" verticalAlignment="center" />
                        <Label col="2" :text="item.valueFormatter ? item.valueFormatter(item.value) : item.value + ''" textAlignment="right" />
                        <MDSlider
                            :id="item.id"
                            :color="accentColor"
                            row="2"
                            col="1"
                            :value="item.value"
                            @valueChange="onSliderChange(item, $event)"
                            :minValue="item.min"
                            :maxValue="item.max"
                            verticalAlignment="center"
                        />
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>

<script lang="ts">
import { openFilePicker } from '@nativescript-community/ui-document-picker';
import { confirm, prompt } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Application, ApplicationSettings, File, Folder, ObservableArray, Utils, knownFolders, path } from '@nativescript/core';
import { TouchGestureEventData } from '@nativescript/core/ui';
import dayjs from 'dayjs';
import fileSize from 'filesize';
import { debounce } from 'helpful-decorators';
import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import {
    AvailableConfigsEvent,
    BLEBatteryEventData,
    BLEConnectionEventData,
    BLEEventData,
    BluetoothHandler,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesDisconnectedEvent,
    GlassesSettings,
    GlassesSettingsEvent,
    hexToBytes
} from '~/handlers/BluetoothHandler';
import { GeoHandler } from '~/handlers/GeoHandler';
import { ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { DURATION_FORMAT, formatDuration } from '~/helpers/formatter';
import { $t, $tc } from '~/helpers/locale';
import { Catch, timeout } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { textColor } from '~/variables';
import { ComponentIds } from '~/vue.prototype';
import OptionSelect from './OptionSelect';

interface Item {
    title: string;
    subtitle: string;
    name?: string;
    description?: string;
    id?;
    checked?;
    isSystem?;
    size?;
    value?;
    min?;
    max?;
    buttonTitle?;
    valueFormatter?;
    currentShift?;
}

@Component({
    components: {}
})
export default class Settings extends BgServiceComponent {
    textColor = textColor;
    navigateUrl = ComponentIds.Settings;

    public connectedGlasses: GlassesDevice = null;
    public gestureEnabled: boolean = false;
    public sensorEnabled: boolean = false;
    public glassesBattery: number = 0;
    public settings: GlassesSettings = null;
    public currentShift: { x: number; y: number } = null;
    configs: ConfigListData = [];
    memory: FreeSpaceData;
    item: Item;

    get firmwareVersion() {
        return this.connectedGlasses?.versions?.firmware;
    }

    get shiftDescription() {
        if (this.currentShift) {
            return `${this.$t('shift_desc')}: ${this.currentShift.x},${this.currentShift.y}`;
        }
        return this.$t('shift_desc');
    }

    constructor() {
        super();
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        if (this.showingTestImage) {
            this.bluetoothHandler.clearFullScreen();
        }
        super.destroyed();
    }
    shift(deltaX, deltaY) {
        this.currentShift.x += deltaX;
        this.currentShift.y += deltaY;

        this.updateGlassesShift();
        const index = this.items.findIndex((i) => i.id === 'shift');
        if (index !== -1) {
            const item = this.items.getItem(index);
            item.currentShift = this.currentShift;
            item.description = this.shiftDescription;
            this.items.setItem(index, item);
        }
    }

    startShiftRepeatTimer;
    startShiftRepeatInterval;
    startShiftRepeat(deltaX, deltaY) {
        clearTimeout(this.startShiftRepeatTimer);
        clearInterval(this.startShiftRepeatInterval);
        this.startShiftRepeatTimer = setTimeout(() => {
            this.startShiftRepeatInterval = setInterval(() => this.shift(deltaX, deltaY), 70);
        }, 500);
    }
    stopShiftRepeat() {
        clearTimeout(this.startShiftRepeatTimer);
        this.startShiftRepeatTimer = null;
        clearInterval(this.startShiftRepeatInterval);
        this.startShiftRepeatInterval = null;
    }

    onShiftTouch(event: TouchGestureEventData, deltaX, deltaY) {
        if (event.action === 'down') {
            this.startShiftRepeat(deltaX, deltaY);
        } else if (event.action === 'up' || event.action === 'cancel') {
            this.stopShiftRepeat();
        }
    }

    @debounce(300)
    updateGlassesShift() {
        this.bluetoothHandler.shiftImage(this.currentShift.x, this.currentShift.y);
        if (this.showingTestImage) {
            this.showTestImage();
        }
    }

    items = new ObservableArray([]);

    @debounce(300)
    updateLuminance(value) {
        this.bluetoothHandler.changeLuminance(value);
    }

    onSliderChange(item, args) {
        const slider = args.object;
        const value = Math.round(slider.value);
        if (item.value === value) {
            return;
        }
        switch (item.id) {
            case 'luminance':
                this.updateLuminance(value);
                break;
            default:
                ApplicationSettings.setNumber(item.id, value);
                break;
        }
        const index = this.items.findIndex((i) => i.id === item.id);
        if (index !== -1) {
            item.value = value;
            this.items.setItem(index, item);
        }
    }
    onCheckedChange(item, event) {
        const toggle = event.object;
        if (toggle.checked === item.checked) {
            return;
        }
        let newValue = toggle.checked;
        switch (item.id) {
            case 'gesture':
                this.bluetoothHandler.switchGesture();
                this.gestureEnabled = newValue = this.bluetoothHandler.isGestureOn;
                break;
            case 'sensor':
                this.bluetoothHandler.switchSensor();
                this.sensorEnabled = newValue = this.bluetoothHandler.isSensorOn;
                break;
        }
        const index = this.items.findIndex((i) => i.id === item.id);
        if (index !== -1) {
            item.checked = newValue;
            this.items.setItem(index, item);
        }
    }

    updateGlassesBattery(value: number) {
        if (value >= 0) {
            this.glassesBattery = value;
        } else {
            this.glassesBattery = undefined;
        }
    }

    onGlassesBattery(e: BLEBatteryEventData) {
        this.updateGlassesBattery(e.data);
    }

    refresh() {
        let items: any[] = [
            { type: 'header', title: $t('settings') },
            { id: 'wallpaper', type: 'button', title: $t('set_wallpaper'), buttonTitle: $t('set') },
            { id: 'sentry', type: 'button', title: $t('upload_logs'), subtitle: $t('internet_needed'), buttonTitle: $t('upload') },
            {
                id: 'instructionRepeatDuration',
                type: 'slider',
                title: $t('instruction_repeat_interval'),
                value: ApplicationSettings.getNumber('instructionRepeatDuration', 30000),
                valueFormatter: (v) => formatDuration(dayjs.duration(v), DURATION_FORMAT.SECONDS),
                step: 500,
                min: 1000,
                max: 50000
            },
            {
                id: 'instructionIntervalDuration',
                type: 'slider',
                valueFormatter: (v) => formatDuration(dayjs.duration(v), DURATION_FORMAT.SECONDS),
                title: $t('instruction_interval_interval'),
                value: ApplicationSettings.getNumber('instructionIntervalDuration', 5000),
                min: 500,
                max: 10000
            },
            {
                id: 'sendStoryWriteTimeout',
                type: 'slider',
                title: $t('send_story_write_timeout'),
                subtitle: $t('send_story_write_timeout_desc'),
                value: ApplicationSettings.getNumber('sendStoryWriteTimeout', 1),
                min: 0,
                max: 20
            }
        ];

        if (this.geoHandler.isMiui()) {
            items.push({ id: 'miui', type: 'button', title: $t('battery_saver'), subtitle: $t('battery_saver_desc'), buttonTitle: $t('open') });
        }
        if (this.connectedGlasses) {
            items = [
                { type: 'header', title: $t('memory') },
                {
                    id: 'refreshMemory',
                    type: 'button',
                    title: $tc('free') + ': ' + fileSize(this.memory?.freeSpace || 0),
                    subtitle: $tc('total') + ': ' + fileSize(this.memory?.totalSize || 0),
                    buttonTitle: $t('refresh')
                },
                { id: 'addConfig', type: 'header', title: $t('configs'), buttonTitle: $t('add') },
                ...(this.configs?.map((c) => ({ ...c, type: 'config' })) || []),
                { type: 'header', title: $t('glasses') },
                { id: 'gesture', type: 'switch', title: $t('gesture'), subtitle: $t('gesture_desc'), checked: this.gestureEnabled },
                { id: 'sensor', type: 'switch', title: $t('auto_luminance'), subtitle: $t('sensor_desc'), checked: this.sensorEnabled },
                { id: 'light', type: 'slider', title: $t('light'), subtitle: $t('light_desc'), value: this.bluetoothHandler.levelLuminance, min: 0, max: 15 },
                { id: 'shift', type: 'shift', title: $t('screen_offset'), description: this.shiftDescription, currentShift: this.currentShift },
                { id: 'checkBetaFirmware', type: 'button', title: $t('beta_firmware'), buttonTitle: $t('check') },
                { id: 'firmwareUpdate', type: 'button', title: $t('update_firmware'), buttonTitle: $t('update') },
                { id: 'reboot', type: 'button', title: $t('reboot_glasses'), buttonTitle: $t('reboot') },
                { id: 'reset', type: 'button', title: $t('reset_glasses'), buttonTitle: $t('reset') }
            ].concat(items);
        }

        this.items.splice(0, this.items.length, ...items);
    }

    onGlassesSettings(e: BLEEventData) {
        this.settings = e.data;
        this.currentShift = null;
        if (this.settings && this.settings.shift) {
            this.currentShift = {
                x: this.settings.shift.x,
                y: this.settings.shift.y
            };
        }
        this.refresh();
    }

    onAvailableConfigs(e: BLEEventData) {
        this.configs = e.data;
        this.refresh();
    }
    sessionStopped = true;
    async setup({ bluetoothHandler, geoHandler }: { bluetoothHandler: BluetoothHandler; geoHandler: GeoHandler }) {
        this.refresh();
        this.gestureEnabled = bluetoothHandler.isGestureOn;
        this.sensorEnabled = bluetoothHandler.isSensorOn;
        this.connectedGlasses = bluetoothHandler.glasses;
        this.sessionStopped = true;

        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.bluetoothHandlerOn(AvailableConfigsEvent, this.onAvailableConfigs, this);
        this.bluetoothHandlerOn(GlassesSettingsEvent, this.onGlassesSettings);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        this.configs = bluetoothHandler.currentConfigs;
        if (this.connectedGlasses) {
            this.updateGlassesBattery(bluetoothHandler.glassesBattery);
            this.onGlassesSettings({ data: this.connectedGlasses.settings } as any);
            this.getMemory();
        }
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        this.connectedGlasses = e.data as GlassesDevice;
        this.glassesBattery = -1;
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.glassesBattery = -1;
        this.hideLoading();
        this.refresh();
    }
    // async getConfigs(refresh = true) {
    //     try {
    //         const result = await this.bluetoothHandler.askConfigs();
    //         this.configs = result?.data || [];
    //         refresh && this.refresh();
    //     } catch (error) {
    //         this.showError(error);
    //     }
    // }

    @Catch()
    async getMemory(refresh = true) {
        console.log('getMemory', refresh);
        this.memory = await this.bluetoothHandler.getMemory(true);
        refresh && this.refresh();
    }
    async pickFile(ext: string) {
        if (__IOS__) {
            const r = await knownFolders
                .documents()
                .getEntities()
                .then((result) => result.filter((s) => s.path.endsWith(ext)));
            if (r && r.length > 0) {
                const options = {
                    props: {
                        title: this.$t('pick_firmware'),
                        options: r.map((e) => ({ title: e.name, data: e.path }))
                    },
                    fullscreen: false
                };
                const result = await this.$showModal(OptionSelect, options);
                if (__IOS__) {
                    // wait a bit or next modal showing will fail
                    await timeout(1000);
                }
                return result?.data as string;
            } else {
                showSnack({ message: this.$t('no_file_found') });
                return undefined;
            }
            // });
        } else {
            const result = await openFilePicker({
                //@ts-ignore
                extensions: __IOS__ ? [kUTTypeData, kUTTypeContent, kUTTypeItem] : ['*/*'],
                multipleSelection: false,
                pickerMode: 0
            });
            if (result.files.length > 0) {
                if (result.files[0].endsWith(ext)) {
                    return result.files[0];
                } else {
                    showSnack({ message: this.$t('no_file_found') });
                }
            } else {
            }
        }
    }

    showingTestImage = false;
    showTestImage() {
        this.showingTestImage = true;
        const filePath = ApplicationSettings.getString('glasses_config_image', path.join(getGlassesImagesFolder(), 'navigation', 'start', 'VG1.png'));
        this.bluetoothHandler.drawImageFromPathWithMire(filePath);
    }

    async pickConfig() {
        const r = (await Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories')).getEntities())
            .concat([{ path: path.join(getGlassesImagesFolder(), 'navigation'), name: 'navigation' }] as any)
            .sort((a, b) => a.name.localeCompare(b.name));
        if (r && r.length > 0) {
            const options = {
                props: {
                    title: this.$t('pick_config_to_send'),
                    options: r.map((e) => ({ title: e.name, data: e.path }))
                },
                fullscreen: false
            };
            const result = await this.$showModal(OptionSelect, options);
            if (__IOS__) {
                // wait a bit or next modal showing will fail
                await timeout(1000);
            }
            return result?.data as string;
        } else {
            showSnack({ message: this.$t('no_config_found') });
            return undefined;
        }
    }

    async onButtonTap(command, item?, event?) {
        try {
            console.log('onButtonTap', command);
            switch (command) {
                case 'wallpaper':
                    await this.setWallpaper();
                    break;
                case 'addConfig':
                    const config = await this.pickConfig();
                    if (config) {
                        await this.bluetoothHandler.sendConfigToGlasses(
                            config,
                            this.memory
                            // (promise) => {
                            //     this.showLoading({
                            //         title: $tc('sending_config', config.split('/').slice(-1)[0]),
                            //         text: '',
                            //         progress: 0,
                            //         onButtonTap: () => promise.cancel()
                            //     });
                            // },
                            // (progress, current, total) => {
                            //     this.updateLoadingProgress({ progress: progress * 100, text: $tc('sending_config_progress', Math.ceil(progress * 100) + '%', fileSize(total)) });
                            // }
                        );
                        await this.getMemory(false);
                        this.refresh();
                    }
                    break;
                case 'deleteCfg':
                    const result = await confirm({
                        title: $tc('delete_config', item.name),
                        okButtonText: $tc('delete'),
                        cancelButtonText: $tc('cancel')
                    });
                    if (result) {
                        this.showLoading();
                        await this.bluetoothHandler.deleteConfig(item.name);
                        // let index = this.items.findIndex((i) => i === item);
                        // if (index !== -1) {
                        //     this.items.splice(index, 1);
                        // }
                        // index = this.configs.findIndex((i) => i.name === item.name);
                        // if (index !== -1) {
                        //     this.configs.splice(index, 1);
                        // }
                        showSnack({ message: $tc('config_deleted', item.name) });
                        await this.getMemory();
                    }
                    break;
                case 'checkBetaFirmware':
                    this.$networkService.checkFirmwareUpdateOnline(this.connectedGlasses.versions, true);
                    break;

                case 'refreshMemory':
                    await this.getMemory();
                    break;

                case 'reset':
                    this.showLoading();
                    await this.setupGlasses();
                    break;

                case 'firmwareUpdate':
                    const pickedFile = await this.pickFile('.img');
                    if (pickedFile) {
                        const component = await import('~/components/FirmwareUpdate');
                        this.$navigateTo(component.default, { props: { firmwareFile: File.fromPath(pickedFile) } });
                    }
                    break;
                case 'drawTestImage':
                    this.showTestImage();
                    break;
                case 'reboot':
                    this.bluetoothHandler.rebootGlasses();
                    break;
                case 'miui':
                    this.geoHandler.openMIUIBatterySaver();
                    break;
                case 'sentry': {
                    const result = await prompt({
                        title: $tc('report'),
                        okButtonText: $tc('send'),
                        cancelButtonText: $tc('cancel'),
                        autoFocus: true,
                        defaultText: 'Rapport ' + new Date().toLocaleString(),
                        textFieldProperties: {
                            marginLeft: 10,
                            marginRight: 10,
                            hint: $tc('name')
                        }
                    });
                    if (result && !!result.result && result.text.length > 0) {
                        this.$crashReportService.captureMessage(result.text);
                    }
                    break;
                }
            }
        } catch (error) {
            this.showError(error);
        } finally {
            this.hideLoading();
        }
    }
    async onLongPress(command: string, event?) {
        if (event && event.ios && event.ios.state !== 3) {
            return;
        }
        switch (command) {
        }
    }
    async setWallpaper() {
        if (__ANDROID__) {
            const context = Utils.ad.getApplicationContext();
            const identifier = context.getResources().getIdentifier('wallpaper', 'drawable', context.getPackageName());
            android.app.WallpaperManager.getInstance(context).setResource(identifier);
        }
    }
    @Catch()
    async setupGlasses() {
        const result = await confirm({
            title: $tc('are_you_sure'),
            message: $tc('reset_glasses_confirm'),
            okButtonText: $tc('reset'),
            cancelButtonText: $tc('cancel')
        });
        if (result) {
            const commands = [hexToBytes('FFB6000ADEADBEEF11AA')];
            console.log('setupGlasses', commands);
            this.bluetoothHandler.sendRawCommands(commands);
            this.refresh();
            const r = (await Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories')).getEntities())
                .concat([{ path: path.join(getGlassesImagesFolder(), 'navigation'), name: 'navigation' }] as any)
                .sort((a, b) => a.name.localeCompare(b.name));
            console.log('r', r);
            for (let index = 0; index < r.length; index++) {
                const element = r[index];
                await this.bluetoothHandler.sendConfigToGlasses(element.path, this.memory);
            }
            await this.getMemory(true);
            await this.bluetoothHandler.askConfigs();
        }
    }
}
</script>
