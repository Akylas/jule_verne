import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { GlassesDevice, GlassesVersions } from '~/handlers/bluetooth/GlassesDevice';
import {
    BLEBatteryEventData,
    BLEConnectionEventData,
    GlassesBatteryEvent,
    GlassesConnectedEvent,
    GlassesDisconnectedEvent,
    GlassesReconnectingEvent,
    GlassesReconnectingFailedEvent,
    Peripheral,
    SPOTA_SERVICE_UUID,
    StatusChangedEvent
} from '~/handlers/BluetoothHandler';
import { FreeSpaceData } from '~/handlers/Message';
import { Catch } from '~/utils';
import { ComponentIds } from '~/vue.prototype';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';

const TAG = '[GlassesConnectionComponent]';
export default class GlassesConnectionComponent extends BgServiceComponent {
    loading = false;

    public connectedGlasses: GlassesDevice = null;
    public glassesBattery: number = 0;
    connectingToGlasses = false;
    public glassesSerialNumber = null;
    public glassesVersions: GlassesVersions = null;
    glassesMemory: FreeSpaceData = null;

    bluetoothEnabled = false;
    gpsEnabled = false;
    autoConnect = false;

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn('error', this.onError);
        this.geoHandlerOn(StatusChangedEvent, this.onGPSStatus);
        this.bluetoothHandlerOn('error', this.onError);
        this.bluetoothHandlerOn(StatusChangedEvent, this.onBLEStatus);

        this.bluetoothHandlerOn(GlassesConnectedEvent, this.onGlassesConnected);
        this.bluetoothHandlerOn(GlassesDisconnectedEvent, this.onGlassesDisconnected);
        this.bluetoothHandlerOn(GlassesBatteryEvent, this.onGlassesBattery);
        this.connectingToGlasses = handlers.bluetoothHandler.connectingToGlasses;
        if (handlers.bluetoothHandler.glasses) {
            this.onGlassesBattery({
                data: handlers.bluetoothHandler.glassesBattery
            } as any);
            this.onGlassesSerialNumber({
                data: handlers.bluetoothHandler.glasses.serialNumber
            } as any);
            this.onGlassesVersion({
                data: handlers.bluetoothHandler.glasses.versions
            } as any);
        }
        this.bluetoothEnabled = this.bluetoothHandler.bluetoothEnabled;
        this.gpsEnabled = this.geoHandler.gpsEnabled;
        if (handlers.bluetoothHandler.glasses) {
            this.onGlassesConnected({ data: handlers.bluetoothHandler.glasses } as any);
        } else if (this.connectedGlasses) {
            this.onGlassesDisconnected({ data: this.connectedGlasses } as any);
        }
        // DEV_LOG && console.log(TAG, this.constructor.name, 'setup', !!handlers.bluetoothHandler.glasses, this.bluetoothEnabled, this.gpsEnabled, this.autoConnect);
    }
    onServiceStarted(handlers: BgServiceMethodParams) {
        if (!handlers.bluetoothHandler.glasses && this.autoConnect) {
            this.tryToAutoConnect();
        }
    }
    onBLEStatus(e) {
        console.log(TAG, 'onBLEStatus', e.data);
        this.bluetoothEnabled = e.data;
        if (this.autoConnect) {
            this.tryToAutoConnect();
        }
    }

    onGPSStatus(e) {
        console.log(TAG, 'onGPSStatus', e.data);
        this.gpsEnabled = e.data;
        if (this.autoConnect) {
            this.tryToAutoConnect();
        }
    }
    onError(event) {
        this.showError(event.data);
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        // console.log(TAG, this.constructor.name, 'onGlassesDisconnected');
        this.connectedGlasses = null;
        this.connectingToGlasses = false;
        this.glassesBattery = -1;
        this.glassesVersions = null;
        this.glassesSerialNumber = null;
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        const glasses = (this.connectedGlasses = e.data as GlassesDevice);
        this.connectingToGlasses = false;
        this.glassesVersions = glasses.versions;
        this.glassesSerialNumber = glasses.serialNumber;
    }
    onGlassesBattery(e: BLEBatteryEventData) {
        this.updateGlassesBattery(e.data);
    }
    updateGlassesBattery(value: number) {
        if (value >= 0) {
            this.glassesBattery = value;
        } else {
            this.glassesBattery = 0;
        }
    }
    onGlassesVersion(e) {
        this.glassesVersions = e.data;
        // this.$networkService.checkFirmwareUpdateOnline(this.glassesVersions);
    }
    onGlassesSerialNumber(e) {
        this.glassesSerialNumber = e.data;
    }

    @Catch()
    async pickGlasses() {
        await this.bluetoothHandler.enableForScan();
        const options = {
            props: {
                modal: true,
                title: this.$t('looking_for_glasses'),
                scanningParams: {
                    glasses: true,
                    filters: [
                        {
                            serviceUUID: SPOTA_SERVICE_UUID
                        }
                    ]
                }
            },
            animated: true,
            fullscreen: true
        };
        const DeviceSelect = (await import('~/components/DeviceSelect.vue')).default;
        const device: Peripheral = await this.$showModal(DeviceSelect, options);
        // console.log(TAG, 'connecting to picked device', device);
        if (device) {
            const promise = this.bluetoothHandler.connect(device.UUID, device.localName);
            this.connectingToGlasses = true;
            return promise;
        }
    }
    @Catch()
    async tryToAutoConnect() {
        DEV_LOG && console.log(TAG, 'tryToAutoConnect', this.bluetoothHandler.bluetoothEnabled);
        if (this.bluetoothHandler.bluetoothEnabled) {
            if (this.bluetoothHandler.hasSavedGlasses()) {
                this.connectingToGlasses = true;
                if (!this.bluetoothHandler.connectingToGlasses) {
                    await this.bluetoothHandler.connectToSaved();
                }
                this.connectingToGlasses = this.bluetoothHandler.connectingToSavedGlasses || this.bluetoothHandler.connectingToGlasses;
            }
        }
    }
    @Catch()
    async connectGlasses() {
        if (this.connectedGlasses) {
            return;
        }
        if (this.bluetoothEnabled && this.gpsEnabled) {
            if (this.bluetoothHandler.savedGlassesUUID) {
                await this.tryToAutoConnect();
            } else {
            }
        }
    }
}
