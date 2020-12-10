import { ReadResult } from '@nativescript-community/ble';
import { Device } from './Device';
import { bluetooth } from '../BluetoothHandler';
import Observable from '@nativescript-community/observable';

export type TypedArray = Int8Array | Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array;

export class Characteristic extends Observable {
    connected = true;
    peripheralUUID: string;
    constructor(public device: Device, public serviceUUID: string, public characteristicUUID: string) {
        super();
        this.peripheralUUID = device.UUID;
    }
    static read(peripheralUUID: string, serviceUUID: string, characteristicUUID: string): Promise<Uint8Array> {
        return bluetooth
            .read({
                peripheralUUID,
                serviceUUID,
                characteristicUUID
            })
            .then((result) => new Uint8Array(result.value));
    }
    read(): Promise<Uint8Array> {
        return Characteristic.read(this.peripheralUUID, this.serviceUUID, this.characteristicUUID);
    }
    static getUint8Value(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, index = 0): Promise<number> {
        return bluetooth
            .read({
                peripheralUUID,
                serviceUUID,
                characteristicUUID
            })
            .then((result) => new DataView(result.value).getUint8(index));
    }
    static getUint32Value(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, index = 0, littleEndian?: boolean): Promise<number> {
        return bluetooth
            .read({
                peripheralUUID,
                serviceUUID,
                characteristicUUID
            })
            .then((result) => new DataView(result.value).getUint32(index, littleEndian));
    }
    static getUint16Value(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, index = 0, littleEndian?: boolean): Promise<number> {
        return bluetooth
            .read({
                peripheralUUID,
                serviceUUID,
                characteristicUUID
            })
            .then((result) => new DataView(result.value).getUint16(index, littleEndian));
    }
    getUint8Value(index = 0): Promise<number> {
        return Characteristic.getUint8Value(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, index);
    }
    getUint16Value(index = 0, littleEndian?: boolean): Promise<number> {
        return Characteristic.getUint32Value(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, index, littleEndian);
    }
    getUint32Value(index = 0, littleEndian?: boolean): Promise<number> {
        return Characteristic.getUint32Value(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, index, littleEndian);
    }
    static write(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, value: ArrayBuffer | TypedArray | string, encoding = 'iso-8859-1') {
        return bluetooth.write({
            peripheralUUID,
            serviceUUID,
            characteristicUUID,
            value
        });
    }
    writeWithoutResponse(value, encoding?) {
        return Characteristic.writeWithoutResponse(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, value, encoding);
    }
    static writeWithoutResponse(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, value: ArrayBuffer | TypedArray | string, encoding = 'iso-8859-1') {
        return bluetooth.writeWithoutResponse({
            peripheralUUID,
            serviceUUID,
            characteristicUUID,
            value
        });
    }
    write(value, encoding?) {
        return Characteristic.write(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, value, encoding);
    }
    static startNotifying(peripheralUUID: string, serviceUUID: string, characteristicUUID: string, onNotify: (result: ReadResult) => void) {
        return bluetooth.startNotifying({
            peripheralUUID,
            serviceUUID,
            characteristicUUID,
            onNotify
        });
    }
    static stopNotifying(peripheralUUID: string, serviceUUID: string, characteristicUUID: string) {
        return bluetooth.stopNotifying({
            peripheralUUID,
            serviceUUID,
            characteristicUUID
        });
    }
    startNotifying(onNotify: (result: ReadResult) => void) {
        return Characteristic.startNotifying(this.peripheralUUID, this.serviceUUID, this.characteristicUUID, onNotify);
    }
    stopNotifying() {
        return Characteristic.stopNotifying(this.peripheralUUID, this.serviceUUID, this.characteristicUUID);
    }
}
