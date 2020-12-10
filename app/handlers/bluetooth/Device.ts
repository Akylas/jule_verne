import { Peripheral } from '@nativescript-community/ble';
import { BluetoothHandler, DEFAULT_MTU, bluetooth } from '../BluetoothHandler';
import { Characteristic } from './Characteristic';
import Observable from '@nativescript-community/observable';

export class Device extends Observable {
    connected = true;
    mtu = DEFAULT_MTU;

    constructor(public peripheral: Peripheral, protected bluetoothHandler: BluetoothHandler) {
        super();
    }
    readDescriptor(serviceUUID: string, characteristicUUID: string): Promise<Uint8Array> {
        // console.log('readDescriptor', this.peripheral.UUID, serviceUUID, characteristicUUID);
        return Characteristic.read(this.peripheral.UUID, serviceUUID, characteristicUUID);
    }
    get UUID() {
        return this.peripheral.UUID;
    }
    onDisconnected() {
        this.connected = false;
    }
    get name() {
        return this.peripheral.name || this.peripheral.localName;
    }
    set name(newName: string) {
        this.peripheral.localName = newName;
    }
    get localName() {
        return (this.peripheral.localName || this.peripheral.name || '').replace(/�/g, '');
    }
    setMtu(value: number) {
        this.mtu = value;
    }
    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }
    requestMtu(value: number) {
        console.log('requestMtu', value);
        return bluetooth
            .requestMtu({
                peripheralUUID: this.peripheral.UUID,
                value
            })
            .then((result) => {
                console.log('result requestMtu', value, result);
                if (result > 0) {
                    this.setMtu(result);
                }
                return this.mtu;
            });
    }
}
