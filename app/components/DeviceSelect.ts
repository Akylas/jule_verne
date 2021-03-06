import { AdvertismentData, Peripheral as IPeripheral } from '@nativescript-community/ble';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { ItemEventData } from '@nativescript/core/ui/list-view';
import { Component, Prop } from 'vue-property-decorator';
import { MICROOLED_MANUFACTURER_ID, MICROOLED_MANUFACTURER_NAME, StartScanningOptions } from '~/handlers/BluetoothHandler';
import BaseVueComponent from './BaseVueComponent';

function calculateDistance(rssi, txPower) {
    // console.log('calculateDistance', rssi, txPower);
    // you can pass txPower to the function
    if (rssi === 0) {
        return -1.0;
    }

    const ratio = (rssi * 1.0) / txPower;
    if (ratio < 1.0) {
        return Math.pow(ratio, 10);
    } else {
        return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
    }
}

export interface Peripheral extends IPeripheral {
    distance?: number;
    txPowerLevel?: number;
    manufacturer?: string;
    advertismentData: AdvertismentData;
    localName?: string;
    type?: string;
}
@Component({})
export default class DeviceSelect extends BaseVueComponent {
    public devices: ObservableArray<Peripheral> = new ObservableArray([] as any);
    public scanning: boolean = false;

    public height = global.isAndroid ? 350 : '100%';

    @Prop({})
    scanningParams?: StartScanningOptions;
    @Prop({ default: 'available devices' })
    title: string;
    // public constructor() {
    //     super();
    // }
    mounted() {
        super.mounted();
        this.startScan().catch((err) => {
            //error is already shown in startScan
            this.close();
        });
    }

    destroyed() {
        super.destroyed();
        this.stopScan();
    }
    onDeviceFound(peripheral: Peripheral) {
        if (!this.scanning) {
            return;
        }

        // should we ignore devices with null name and localName?
        if (!peripheral.localName && !peripheral.name) {
            return;
        }
        const localName = (peripheral.localName || peripheral.name).replace(/�/g, '');
        const deviceData = {
            UUID: peripheral.UUID,
            RSSI: peripheral.RSSI,
            name: peripheral.name,
            txPowerLevel: peripheral.advertismentData.txPowerLevel,
            manufacturerId: peripheral.advertismentData.manufacturerId,
            localName
        } as Peripheral;
        if (deviceData.txPowerLevel >= 0) {
            deviceData.distance = calculateDistance(deviceData.RSSI, deviceData.txPowerLevel);
        }

        // filter for allowed manufacturers
        if (this.scanningParams.glasses) {
            if (
                deviceData.manufacturerId !== 0xdafa && // old deprecated Microoled manufacturerId
                deviceData.manufacturerId !== MICROOLED_MANUFACTURER_ID &&
                deviceData.manufacturerId !== 0xfada && // ascii version
                localName.indexOf(MICROOLED_MANUFACTURER_NAME) === -1
            ) {
                return;
            }
            deviceData.manufacturer = MICROOLED_MANUFACTURER_NAME;
            deviceData.manufacturerId = MICROOLED_MANUFACTURER_ID;
            if (/Microoled/.test(localName)) {
                deviceData.localName = localName.slice(10);
            }
        }

        const devices = this.devices;

        const found = devices.some((d, index) => {
            if (d.UUID === deviceData.UUID) {
                return true;
            }
            return false;
        });
        if (!found) {
            devices.push(Object.assign({}, deviceData));
        }
    }
    get bluetoothHandler() {
        return this.$bgService.bluetoothHandler;
    }

    public close(peripheral?: Peripheral) {
        this.stopScan();
        this.$modal.close(peripheral);
    }

    actualScan() {
        return this.bluetoothHandler.startScanning({
            seconds: 5,
            onDiscovered: this.onDeviceFound.bind(this),
            filters: this.scanningParams.filters
        });
    }
    startScan() {
        if (!this.scanning) {
            return this.$bgService.geoHandler.enableLocation().then(() => {
                this.devices = new ObservableArray([] as any);
                this.scanning = true;
                const createScanStep = () => {
                    if (!this.scanning) {
                        return Promise.reject(undefined);
                    }
                    return this.actualScan().then(() => {
                        if (!this.scanning) {
                            return Promise.reject(undefined);
                        }
                    });
                };
                // run actual scan 4 times 4 * 5 = 20s
                const promise = Promise.resolve()
                    .then(createScanStep)
                    .then(createScanStep)
                    .then(createScanStep)
                    .then(createScanStep)
                    .then(() => {
                        this.scanning = false;
                    })
                    .catch((err) => {
                        this.scanning = false;
                        if (err) {
                            this.showError(err);
                        }
                        return Promise.reject(err);
                    });
                return promise;
            });
        } else {
            return Promise.resolve();
        }
    }
    stopScan() {
        this.scanning = false;
        this.bluetoothHandler.stopScanning();
    }

    public onItemTap(device: Peripheral, args: ItemEventData) {
        if (device) {
            this.close(device);
        }
    }

    itemRightValue(item: Peripheral) {
        if (this.devMode) {
            return item.RSSI;
        }
        // if (item.hasOwnProperty('distance')) {
        //     return item.distance;
        // }
    }
}
