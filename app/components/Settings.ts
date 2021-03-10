import { openFilePicker } from '@nativescript-community/ui-document-picker';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { File, knownFolders } from '@nativescript/core/file-system';
import { TouchGestureEventData } from '@nativescript/core/ui';
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
import { timeout } from '~/utils';
import { ComponentIds } from './App';
import FirmwareUpdate from './FirmwareUpdate';
import OptionSelect from './OptionSelect';

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
        super.destroyed();
    }
    shift(deltaX, deltaY) {
        this.currentShift.x += deltaX;
        this.currentShift.y += deltaY;
        this.updateGlassesShift();
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
    }

    @debounce(300)
    onLuminanceChange(args) {
        const slider = args.object;
        const value = Math.round(slider.value);
        this.bluetoothHandler.changeLuminance(value);
        this.levelLuminance = this.bluetoothHandler.levelLuminance;
    }

    switchGesture(args) {
        const toggle = args.object;
        if (toggle.checked === this.gestureEnabled) {
            return;
        }
        this.bluetoothHandler.switchGesture();
        this.gestureEnabled = this.bluetoothHandler.isGestureOn;
    }
    switchSensor(args) {
        const toggle = args.object;
        if (toggle.checked === this.sensorEnabled) {
            return;
        }
        this.bluetoothHandler.switchSensor();
        this.sensorEnabled = this.bluetoothHandler.isSensorOn;
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

    onGlassesSettings(e: BLEEventData) {
        this.settings = e.data;
        this.currentShift = null;
        if (this.settings && this.settings.shift) {
            this.currentShift = {
                x: this.settings.shift.x,
                y: this.settings.shift.y
            };
        }
    }
    sessionStopped = true;
    setup({ bluetoothHandler, geoHandler }: { bluetoothHandler: BluetoothHandler; geoHandler: GeoHandler }) {
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
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        this.connectedGlasses = e.data as GlassesDevice;
        this.glassesBattery = -1;
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.glassesBattery = -1;
    }
    async pickFile(ext: string) {
        console.log('pickFile', ext);
        if (global.isIOS) {
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
                if (global.isIOS) {
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
                extensions: global.isIOS ? [kUTTypeData, kUTTypeContent, kUTTypeItem] : ['*/*'],
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
    async onTap(command: string, event?) {
        console.log('onTap', command);
        switch (command) {
            case 'checkBetaFirmware':
                this.$getAppComponent().checkFirmwareUpdateOnline(this.devMode);
                break;

            case 'firmwareUpdate':
                const pickedFile = await this.pickFile('.img');
                console.log('pickedFile', pickedFile);
                if (pickedFile) {
                    this.$getAppComponent().navigateTo(FirmwareUpdate, { props: { firmwareFile: File.fromPath(pickedFile) } });
                }
                break;
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
