import { openFilePicker } from '@nativescript-community/ui-document-picker';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, knownFolders, path } from '@nativescript/core/file-system';
import { TouchGestureEventData } from '@nativescript/core/ui';
import fileSize from 'filesize';
import { debounce } from 'helpful-decorators';
import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import {
    BLEBatteryEventData,
    BLEConnectionEventData,
    BLEEventData,
    BluetoothHandler,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesDisconnectedEvent,
    GlassesSettings,
    GlassesSettingsEvent
} from '~/handlers/BluetoothHandler';
import { GeoHandler } from '~/handlers/GeoHandler';
import { CommandType, ConfigListData, FreeSpaceData } from '~/handlers/Message';
import { $t, $tc } from '~/helpers/locale';
import { MessageError } from '~/services/CrashReportService';
import { timeout } from '~/utils';
import { ComponentIds } from './App';
import FirmwareUpdate from './FirmwareUpdate';
import OptionSelect from './OptionSelect';
import { getGlassesImagesFolder } from '~/utils/utils';

@Component({
    components: {}
})
export default class Settings extends BgServiceComponent {
    navigateUrl = ComponentIds.Settings;

    public connectedGlasses: GlassesDevice = null;
    public gestureEnabled: boolean = false;
    public sensorEnabled: boolean = false;
    public glassesBattery: number = 0;
    public levelLuminance: number = 0;
    public settings: GlassesSettings = null;
    public currentShift: { x: number; y: number } = null;
    configs: ConfigListData = [];
    memory: FreeSpaceData;

    get firmwareVersion() {
        return this.connectedGlasses && this.connectedGlasses.firmwareVersion;
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
    onSliderChange(item, args) {
        const slider = args.object;
        const value = Math.round(slider.value);
        if (item.value === value) {
            return;
        }
        let newValue = value;
        switch (item.id) {
            case 'luminance':
                this.bluetoothHandler.changeLuminance(value);
                this.levelLuminance = newValue = this.bluetoothHandler.levelLuminance;
                break;
        }
        const index = this.items.findIndex((i) => i.id === item.id);
        if (index !== -1) {
            item.value = newValue;
            this.items.setItem(index, item);
        }
    }
    onCheckedChange(item, event) {
        const toggle = event.object;
        console.log('onCheckedChange', item, toggle.checked);
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
        this.items = new ObservableArray([
            { type: 'header', title: $t('memory') },
            {
                id: 'refreshMemory',
                type: 'button',
                title: $tc('free') + ': ' + fileSize(this.memory?.freeSpace || 0),
                subtitle: $tc('total') + ': ' + fileSize(this.memory?.totalSize || 0),
                buttonTitle: $t('refresh')
            },
            { id: 'addConfig', type: 'header', title: $t('configs'), buttonTitle: $t('add') },
            ...this.configs.map((c) => ({ ...c, type: 'config' })),
            { type: 'header', title: $t('settings') },
            { id: 'gesture', type: 'switch', title: $t('gesture'), subtitle: $t('gesture_desc'), checked: this.gestureEnabled },
            { id: 'sensor', type: 'switch', title: $t('auto_luminance'), subtitle: $t('sensor_desc'), checked: this.sensorEnabled },
            { id: 'light', type: 'slider', title: $t('light'), subtitle: $t('light_desc'), value: this.levelLuminance },
            { id: 'shift', type: 'shift', description: this.shiftDescription, currentShift: this.currentShift },
            { id: 'checkBetaFirmware', type: 'button', title: $t('beta_firmware'), buttonTitle: $t('check_update') },
            { id: 'firmwareUpdate', type: 'button', title: $t('firmware'), subtitle: this.firmwareVersion, buttonTitle: $t('update_firmware') }
        ]);
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
    sessionStopped = true;
    async setup({ bluetoothHandler, geoHandler }: { bluetoothHandler: BluetoothHandler; geoHandler: GeoHandler }) {
        this.levelLuminance = bluetoothHandler.levelLuminance;
        this.gestureEnabled = bluetoothHandler.isGestureOn;
        this.sensorEnabled = bluetoothHandler.isSensorOn;
        this.connectedGlasses = bluetoothHandler.glasses;
        this.sessionStopped = true;
        if (this.connectedGlasses) {
            this.updateGlassesBattery(bluetoothHandler.glassesBattery);
            this.onGlassesSettings({ data: this.connectedGlasses.settings } as any);
        }
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.bluetoothHandlerOn(GlassesSettingsEvent, this.onGlassesSettings);
        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);

        await this.getConfigs(false);
        await this.getMemory(false);
        this.refresh();
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        this.connectedGlasses = e.data as GlassesDevice;
        this.glassesBattery = -1;
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.glassesBattery = -1;
        this.hideLoading();
    }
    async getConfigs(refresh = true) {
        try {
            const result = await this.bluetoothHandler.sendCommand({ command: CommandType.cfgList, timestamp: Date.now() });
            this.configs = result?.data || [];
            console.log('getConfigs', this.configs);
            refresh && this.refresh();
        } catch (error) {
            this.showError(error);
        }
    }
    async getMemory(refresh = true) {
        try {
            const result = await this.bluetoothHandler.sendCommand({ command: CommandType.cfgFreeSpace, timestamp: Date.now() });
            this.memory = result?.data || ({} as any);
            console.log('getMemory', this.memory);
            refresh && this.refresh();
        } catch (error) {
            this.showError(error);
        }
    }
    async pickFile(ext: string) {
        console.log('pickFile', ext);
        if (__IOS__) {
            const r = await knownFolders
                .documents()
                .getEntities()
                .then((result) => result.filter((s) => s.path.endsWith(ext)));
            console.log('r', r);
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
        this.bluetoothHandler.clearFullScreen();
        this.bluetoothHandler.setConfig(this.configs.filter((c) => c.name !== 'ALook[')[0].name);
        this.bluetoothHandler.sendBitmap(1);
    }

    async pickConfig() {
        console.log('pickConfig');
        const r = (await Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories')).getEntities()).concat([
            { path: path.join(getGlassesImagesFolder(), 'navigation'), name: 'navigation' }
        ] as any);
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
    async onButtonTap(command, item) {
        console.log('onButtonTap', command, item);
        try {
            switch (command) {
                case 'addConfig':
                    const config = await this.pickConfig();
                    if (config) {
                        await new Promise<void>(async (resolve) => {
                            const size = File.fromPath(path.join(config, 'images.bin')).size;
                            console.log('addConfig', config, this.memory, size);
                            if (size >= this.memory.freeSpace) {
                                throw new MessageError({ message: $tc('not_enough_memory', size, this.memory.freeSpace) });
                            }
                            const promise = this.bluetoothHandler.sendLayoutConfig(path.join(config, 'images.txt'), (progress, current, total) => {
                                console.log('sendLayoutConfig progress', progress, current, total);
                                this.updateLoadingProgress({ progress: progress * 100, text: $tc('sending_config_progress', Math.ceil(progress * 100) + '%', fileSize(total)) });
                                if (progress === 1) {
                                    resolve();
                                }
                            });
                            this.showLoading({
                                title: $tc('sending_config', config.split('/').slice(-1)[0]),
                                text: '',
                                progress: 0,
                                onButtonTap: () => promise.cancel()
                            });
                        });
                        console.log('config sent');
                        await this.getConfigs(false);
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
                        const done = await this.bluetoothHandler.sendCommand({ command: CommandType.cfgDelete, params: { name: item.name } });
                        let index = this.items.findIndex((i) => i === item);
                        if (index !== -1) {
                            this.items.splice(index, 1);
                        }
                        index = this.configs.findIndex((i) => i.name === item.name);
                        if (index !== -1) {
                            this.configs.splice(index, 1);
                        }
                        showSnack({ message: $tc('config_deleted', item.name) });
                        await this.getMemory();
                    }
                    break;
                case 'checkBetaFirmware':
                    this.$getAppComponent().checkFirmwareUpdateOnline(this.devMode);
                    break;

                case 'refreshMemory':
                    this.getMemory();
                    break;

                case 'firmwareUpdate':
                    const pickedFile = await this.pickFile('.img');
                    console.log('pickedFile', pickedFile);
                    if (pickedFile) {
                        this.$getAppComponent().navigateTo(FirmwareUpdate, { props: { firmwareFile: File.fromPath(pickedFile) } });
                    }
                    break;
                case 'drawTestImage':
                    this.showTestImage();
                    break;
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
}
