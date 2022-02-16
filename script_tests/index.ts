import fs from 'fs';
import path from 'path';
import noble from '@abandonware/noble';
import { EventEmitter } from 'events';
import Lyric from '../app/handlers/Lyric';
import {
    CONFIG_NAME,
    CONFIG_PASSWORD,
    CONFIG_VERSION,
    CommandType,
    InputCommandType,
    Message,
    MessageParser,
    ParseResult,
    ParsingState,
    ProgressData,
    buildMessageData,
} from '../app/handlers/Message';
import SerialPort from 'serialport';
import ora from 'ora';
import inquirer from 'inquirer';
import cv2 from 'opencv4nodejs';
const player = require('node-wav-player');
import { buildDataSet, createBitmapData, getFolder, pictureDimensionToByteArray } from './common';
let isInDemo = false;
let connectThroughBLE = true;

import { program } from '@caporal/core';
let configId = '1';
program
    .option('--id [id]', 'config id', { default: '1' })
    .option('--serial', 'only serial', { default: false })
    .action(({ logger, args, options }) => {
        configId = options.id + '';
        connectThroughBLE = !options.serial;
        console.log('options', options);
        main();
    });

program.run();

const CONFIG_PARAMS = {
    name: CONFIG_NAME,
    version: CONFIG_VERSION,
    password: CONFIG_PASSWORD
};

const inquirerFileTreeSelection = require('inquirer-file-tree-selection-prompt');
inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
const ui = new inquirer.ui.BottomBar({ bottomBar: 'searching for your glasses' });

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
process.env.NOBLE_MULTI_ROLE = '1';
// let noble: typeof INoble;
// if (/^win/.test(process.platform)) {
//     noble = require('noble-uwp');
// } else {
//     noble = require('noble-mac');
// }

const SERVER_SERVICE_UUID = '0783b03e8535b5a07140a304d2495cb7';
const TX_SERVER_UUID = '0783b03e8535b5a07140a304d2495cb8';
const RX_SERVER_UUID = '0783b03e8535b5a07140a304d2495cba';
export const FLOW_SERVER_UUID = '0783b03e8535b5a07140a304d2495cb9';
export const GESTURE_CHAR_UUID = '0783b03e8535b5a07140a304d2495cbb';
export const BUTTON_CHAR_UUID = '0783b03e8535b5a07140a304d2495cbc';

const DEFAULT_MTU = 253;
const CONTROL_CHAR = String.fromCharCode(0);
const DEFAULT_WRITE_TIMEOUT = 0;

export interface ProgressListener {
    total: number;
    current: number;
    onProgress: ProgressCallback;
}

function log(...args) {
    ui.log.write(args.join(' '));
}

class BluetoothDevice extends EventEmitter {
    services: noble.Service[];
    characteristics: noble.Characteristic[];

    constructor(protected peripheral: noble.Peripheral) {
        super();
    }

    discoverAll(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.peripheral.discoverAllServicesAndCharacteristics((error: string, services: noble.Service[], characteristics: noble.Characteristic[]) => {
                if (error) {
                    reject(error);
                } else {
                    this.services = services;
                    this.characteristics = characteristics;
                    resolve();
                }
            });
        });
    }
    disconnect() {
        if (this.peripheral.state === 'disconnected') {
            return Promise.resolve();
        } else {
            return new Promise<void>((resolve, reject) => {
                this.peripheral.disconnect(resolve);
            });
        }
    }
    connect(): Promise<any> {
        if (this.peripheral.state === 'connected') {
            return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
            this.peripheral.connect((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }).then(() => this.discoverAll());
    }
    getCharacteristic(serviceUUID: string, characteristicUUID: string) {
        return this.characteristics.find((c) => c.uuid.toLowerCase() === characteristicUUID.toLowerCase() && c['_serviceUuid'].toLowerCase() === serviceUUID.toLowerCase());
    }
    write(serviceUUID: string, characteristicUUID: string, value, withoutResponse = false) {
        const characteristic = this.getCharacteristic(serviceUUID, characteristicUUID);
        if (characteristic) {
            return new Promise<void>((resolve, reject) => {
                // log('write', serviceUUID, characteristicUUID, value, withoutResponse);
                characteristic.write(value, withoutResponse, function (error) {
                    log('write done', error);
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            return Promise.reject('char_not_found');
        }
    }
    notify(serviceUUID: string, characteristicUUID: string, notify: boolean) {
        const characteristic = this.getCharacteristic(serviceUUID, characteristicUUID);
        if (characteristic) {
            return new Promise<void>((resolve, reject) => {
                characteristic.notify(notify, function (error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            return Promise.reject('char_not_found');
        }
    }
    readChar(serviceUUID: string, characteristicUUID: string): Promise<Buffer> {
        const characteristic = this.getCharacteristic(serviceUUID, characteristicUUID);
        if (characteristic) {
            return new Promise((resolve, reject) => {
                characteristic.read(function (error, data) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(data);
                    }
                });
            });
        } else {
            return Promise.reject('char_not_found');
        }
    }
    readDeviceInformation(characteristicUUID: string) {
        return this.readChar('180a', characteristicUUID);
    }
}

class BufferSendingCharacteristic {
    // characteristic: INoble.Characteristic;
    toSend?: Uint8Array;
    writing = false;
    mtu = DEFAULT_MTU;
    progressListener: ProgressListener;
    writeWithoutResponse = false;
    _canSendData = true;
    get canSendData() {
        return this._canSendData;
    }
    set canSendData(value: boolean) {
        if (value === this._canSendData) {
            return;
        }
        this._canSendData = value;
        // log('GlassesRXCharacteristic', 'set canSendData', value, !!this.toSend, this.writing);
        if (value && !this.writing) {
            if (!!this.toSend) {
                // log('send Slice');
                this.sendSliceData();
            } else {
                // log('handle');
                this.handleSent();
            }
        }
    }
    constructor(protected characteristic: noble.Characteristic) {
        // log('BufferSendingCharacteristic', characteristic.uuid, characteristic.properties);
        // this.writeWithoutResponse = characteristic.properties.indexOf('writeWithoutResponse') !== -1;
    }
    public sendData(toSend: string | Uint8Array, progressCallback?: ProgressCallback) {
        if (progressCallback) {
            this.progressListener = {
                total: toSend.length + (this.toSend ? this.toSend.length : 0),
                current: 0,
                onProgress: progressCallback
            };
        }
        const buffer = toSend instanceof Uint8Array ? toSend : Buffer.from(toSend, 'latin1');
        if (!this.toSend) {
            this.toSend = buffer;
        } else {
            this.toSend = Buffer.concat([this.toSend, buffer]);
        }
        if (!this.writing) {
            this.sendSliceData();
        }
    }
    handleProgress = (sentLength: number) => {
        if (this.progressListener) {
            const listener = this.progressListener;
            listener.current = Math.min(listener.current + sentLength, listener.total);
            // log('handleProgress', sentLength, listener.current / listener.total);
            listener.onProgress(null, listener.current / listener.total, listener.total);
        }
    };
    handleSent() {
        // log('handleSent1');
        this.progressListener = null;
    }
    sendSliceData = () => {
        // log('sendSliceData', !!this.characteristic, this._canSendData, this.toSend ? this.toSend.length : 0);
        if (!this._canSendData) {
            return;
        }
        if (!this.characteristic) {
            this.toSend = null;
            this.writing = false;
            this.handleSent();
            return;
        }
        const length = this.toSend ? this.toSend.length : 0;
        if (length > 0) {
            this.writing = true;
            const slice = this.toSend.slice(0, this.mtu);
            const length = this.toSend.length;
            if (length === 0) {
                this.toSend = null;
            } else {
                this.toSend = this.toSend.slice(this.mtu);
            }
            // console.log('write', slice.length, slice.byteLength, this.writeWithoutResponse, slice);
            this.characteristic.write(slice as any, this.writeWithoutResponse, (error) => {
                // log('write done', error);
                if (error) {
                    this.writing = false;
                    this.toSend = null;
                    this.clearProgressListeners(error);
                    this.handleSent();
                } else {
                    this.handleProgress(slice.length);
                }
                setTimeout(() => {
                    this.writing = false;
                    this.sendSliceData();
                }, DEFAULT_WRITE_TIMEOUT);
            });
        } else {
            this.writing = false;
            this.handleSent();
        }
    };
    clearProgressListeners(err) {
        // log('sendSlclearProgressListenersiceData', !!this.progressListener);
        if (this.progressListener) {
            this.progressListener.onProgress(err, null, 0);
            this.progressListener = null;
        }
    }
}

class CommandSendingCharacteristic extends BufferSendingCharacteristic {
    sendingCommand = false;
    pendingCommands: {
        data: string;
        progressCallback?: ProgressCallback;
    }[] = [];
    constructor(char) {
        super(char);
    }
    handleSent() {
        super.handleSent();
        this.sendingCommand = false;
        // log('handleSent', this.pendingCommands.length);
        if (this.pendingCommands.length > 0) {
            const data = this.pendingCommands.shift();
            this.sendCommand(data.data, data.progressCallback);
        }
    }
    public sendCommand(command: string, progressCallback?: ProgressCallback) {
        if (this.sendingCommand || this.writing) {
            this.pendingCommands.push({ data: command, progressCallback });
            return;
        }
        this.sendingCommand = true;
        this.sendData(command, progressCallback);
    }
}
class BinaryCommandSendingCharacteristic extends BufferSendingCharacteristic {
    sendingCommand = false;
    pendingCommands: {
        data: Uint8Array;
        progressCallback?: ProgressCallback;
    }[] = [];
    constructor(char) {
        super(char);
    }
    handleSent() {
        super.handleSent();
        this.sendingCommand = false;
        // log('handleSent', this.pendingCommands.length);
        if (this.pendingCommands.length > 0) {
            const data = this.pendingCommands.shift();
            this.sendCommand(data.data, data.progressCallback);
        }
    }
    public sendCommand(command: Uint8Array, progressCallback?: ProgressCallback) {
        if (this.sendingCommand || this.writing) {
            this.pendingCommands.push({ data: command, progressCallback });
            return;
        }
        this.sendingCommand = true;
        this.sendData(command, progressCallback);
    }

    public sendBinaryCommand<T extends CommandType>(
        commandType: T,
        options: {
            timestamp?: number;
            params?: InputCommandType<T>;
            progressCallback?: ProgressCallback;
        } = {}
    ) {
        const messageData = buildMessageData(commandType, options);
        // console.log('sendBinaryCommand', CommandType[commandType], messageData, Date.now());
        if (this.sendingCommand || this.writing || !this.canSendData) {
            this.pendingCommands.push({
                data: messageData,
                progressCallback: options.progressCallback
            });
            return;
        }

        this.sendingCommand = true;
        this.sendData(messageData, options.progressCallback);
    }
}

class UARTDevice extends BluetoothDevice {
    rxCharacteristic: BinaryCommandSendingCharacteristic;
    txCharacteristic: noble.Characteristic;

    // public sendCommand(command: string, progressCallback?: ProgressCallback) {
    //     this.rxCharacteristic.sendCommand(command, progressCallback);
    // }
    messagePromises: { [key: string]: { resolve: Function; reject: Function; timeoutTimer: NodeJS.Timer }[] } = {};

    async sendBinaryCommand<T extends CommandType>(
        commandType: T,
        options: {
            timestamp?: number;
            params?: InputCommandType<T>;
            progressCallback?: ProgressCallback;
            timeout?: number;
        } = {}
    ) {
        if (options.timestamp) {
            const id = options.timestamp;
            return new Promise<Message<T>>((resolve, reject) => {
                this.messagePromises[id] = this.messagePromises[id] || [];
                let timeoutTimer;
                if (options.timeout > 0) {
                    timeoutTimer = setTimeout(() => {
                        // we need to try catch because the simple fact of creating a new Error actually throws.
                        // so we will get an uncaughtException
                        try {
                            reject(new Error('timeout'));
                        } catch {}
                        delete this.messagePromises[id];
                    }, options.timeout);
                }
                this.messagePromises[id].push({ resolve, reject, timeoutTimer });
                this.rxCharacteristic.sendBinaryCommand<T>(commandType, options);
            });
        } else {
            return this.rxCharacteristic.sendBinaryCommand(commandType, options) as any as Message<T>;
        }
    }

    discoverAll(): Promise<any> {
        return super.discoverAll().then(() => {
            // log('finding UART chars');
            this.txCharacteristic = this.characteristics.find((c) => c.uuid === TX_SERVER_UUID);
            this.rxCharacteristic = new BinaryCommandSendingCharacteristic(this.characteristics.find((c) => c.uuid === RX_SERVER_UUID));
            // log('ffound chars', !!this.txCharacteristic, !!this.rxCharacteristic);
            return new Promise<void>((resolve: () => void, reject) => {
                // log('subscribe tx');
                this.txCharacteristic.subscribe((error) => {
                    // log('subscribe tx done', error);
                    if (error) {
                        reject(error);
                    } else {
                        this.txCharacteristic.on('data', (data, isNotification) => {
                            // console.log('tx', data);
                            this.emit('data', { data, isNotification });
                        });
                        resolve();
                    }
                });
            });
        });
    }
}
export type ProgressCallback = (error: Error, progress: number, total: number) => void;
export interface ProgressResult {
    queryId?: number;
    averageSpeed?: number;
    total?: number;
    percentage: number;
    remainingTime?: number;
}

const SMOOTHING_FACTOR = 0.005;
export class ProgressEstimator extends EventEmitter {
    averageSpeed = 0; // kb/s
    totalSize: number;

    lastEstimateTimestamp: number;
    lastCurrent = 0;
    estimate = (e: ProgressData) => {
        const now = new Date().valueOf();
        const queryId = e.queryId;
        const current = e.hasOwnProperty('sent') ? e.sent : e.received;
        const total = e.total;
        if (this.lastEstimateTimestamp) {
            const deltaT = now - this.lastEstimateTimestamp;
            if (deltaT <= 1 && current !== total) {
                return;
            }
            const deltaS = current - this.lastCurrent;
            const lastSpeed = deltaS / deltaT;
            this.averageSpeed = SMOOTHING_FACTOR * lastSpeed + (1 - SMOOTHING_FACTOR) * this.averageSpeed;
            if (current === total) {
                this.lastEstimateTimestamp = undefined;
                this.lastCurrent = 0;
                this.averageSpeed = 0;
            } else {
                this.lastEstimateTimestamp = now;
                this.lastCurrent = current;
            }
            return {
                queryId,
                averageSpeed: this.averageSpeed,
                total,
                percentage: current / total,
                remainingTime: Math.floor((total - current) / this.averageSpeed) // ms
            } as ProgressResult;
        } else {
            if (current === total) {
                this.lastEstimateTimestamp = undefined;
                this.lastCurrent = 0;
                this.averageSpeed = 0;
            } else {
                this.lastEstimateTimestamp = now;
                this.lastCurrent = current;
            }
            return {
                queryId,
                averageSpeed: 0,
                total,
                percentage: current / total,
                remainingTime: -1
            } as ProgressResult;
        }
    };
}

class MicrooledDevice extends UARTDevice {
    hasFlowControl = false;
    parser: MessageParser;
    constructor(p) {
        super(p);
        this.parser = new MessageParser(this.onMessage.bind(this));
    }
    discoverAll() {
        return super.discoverAll().then(() => {
            log(
                'discoveredAll',
                this.services.map((s) => s.uuid),
                this.characteristics.map((s) => s.uuid)
            );
            const index = this.services.findIndex((s) => s.uuid.toLowerCase() === SERVER_SERVICE_UUID);
            this.hasFlowControl = this.services[index].characteristics.findIndex((c) => c.uuid.toLowerCase() === FLOW_SERVER_UUID) !== -1;
        });
    }
    public sendBinaryCommandToGlasses<T extends CommandType>(
        command: T,
        options: {
            timestamp?: number;
            params?: InputCommandType<T>;
            progressCallback?: ProgressCallback;
        } = {}
    ) {
        return this.sendBinaryCommand<T>(command, options);
    }

    displayLayout(layout, param) {
        this.sendBinaryCommandToGlasses(CommandType.Layout, {
            params: [layout, param]
        });
    }
    sendText(x, y, direction, font, color, message) {
        return this.sendBinaryCommandToGlasses(CommandType.Txt, { params: [x, y, direction, font, color, message] });
    }
    async sendWriteConfig(params: InputCommandType<CommandType.cfgWrite>) {
        return this.sendBinaryCommandToGlasses(CommandType.cfgWrite, { params });
    }
    async sendReadConfig(configId: number) {
        return this.sendBinaryCommandToGlasses(CommandType.cfgRead, { params: [configId] });
    }
    sendBitmap(number, x, y) {
        return this.sendBinaryCommandToGlasses(CommandType.imgDisplay, { params: [number, x, y] });
    }

    sendLayout(number, value) {
        this.sendBinaryCommandToGlasses(CommandType.Layout, { params: [number, value] });
    }
    sendFullRectangle(x: number, y: number, xx: number, yy: number) {
        this.sendBinaryCommandToGlasses(CommandType.Rectf, { params: [x, y, xx, yy] });
    }
    sendColor(color: number) {
        this.sendBinaryCommandToGlasses(CommandType.Color, { params: [color] });
    }
    sendEmptyRectangle(x: number, y: number, xx: number, yy: number) {
        this.sendColor(0);
        this.sendFullRectangle(x, y, xx, yy);
    }
    clearFullScreen() {
        this.sendBinaryCommandToGlasses(CommandType.Clear);
    }

    clearScreen() {
        this.sendEmptyRectangle(0, 0, 303, 230);
    }
    isScreenOn = true;
    startTime: Date;
    currentScreen = 0;
    switchScreenOnOff() {
        log('switchScreenOnOff', this.isScreenOn);
        this.isScreenOn = !this.isScreenOn;

        if (this.isScreenOn) {
        } else {
            this.clearFullScreen();
        }
    }
    onMessage(message: Message<any>) {
        const id = message.queryId;
        if (id && this.messagePromises.hasOwnProperty(id)) {
            this.messagePromises[id].forEach(function (executor) {
                executor.timeoutTimer && clearTimeout(executor.timeoutTimer);
                executor.resolve(message);
            });
            delete this.messagePromises[id];
        } else {
            console.log(CommandType[message.commandType], message.data);
        }
        // this.notify({
        //     eventName: 'message',
        //     object: this,
        //     message,
        // });
    }
}

function readBattery() {
    bluetoothDevice.readChar('180f', '2a19').then((r) => log('Battery level', r[0]));
}

function onGlassesConnected(peripheral: noble.Peripheral) {
    // const batteryChar = bluetoothDevice.getCharacteristic('180F', '2a19');
    // batteryChar.on('data', (data) => log('on battery', data[0]));
    // batteryChar.subscribe();
    // bluetoothDevice.rxCharacteristic.mtu = peripheral['mtu'];
    log('onGlassesConnected', bluetoothDevice.hasFlowControl, peripheral['mtu'], bluetoothDevice.getCharacteristic(SERVER_SERVICE_UUID, FLOW_SERVER_UUID));
    if (bluetoothDevice.hasFlowControl) {
        const flowControlChar = bluetoothDevice.getCharacteristic(SERVER_SERVICE_UUID, FLOW_SERVER_UUID);
        if (flowControlChar) {
            flowControlChar.on('data', (data) => {
                log('on flowControl', data[0]);
                if (data[0] !== 0x03) {
                    bluetoothDevice.rxCharacteristic.canSendData = data[0] === 0x01;
                }
            });
            flowControlChar.subscribe();
        }
    }

    bluetoothDevice.on('data', (data, isNotification) => {
        // console.log("read on BLE TX:", data, data.data);

        bluetoothDevice.parser.parseData(data.data);
    });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Power, { params: ['on'] });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Gesture, { params: ['off'] });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Als, { params: ['off'] });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Luma, { params: [6] });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Clear);
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Shift, { params: [0, 0] });
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.Settings);
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.cfgFreeSpace);
    bluetoothDevice.sendBinaryCommandToGlasses(CommandType.cfgList);

    // setTimeout(() => {
    // batteryInterval = setInterval(readBattery, 60000);
    readBattery();
    bluetoothDevice.readDeviceInformation('2a26').then((r) => log('Firmware Version', r.toString()));
    bluetoothDevice.readDeviceInformation('2a25').then((r) => {
        log('Serial Number', r.toString());
        // TODO: check version to see if binary and thus gestures char
        // const gestureChar = bluetoothDevice.getCharacteristic(SERVER_SERVICE_UUID, GESTURE_CHAR_UUID);
        // gestureChar.on('data', (data) => log('on gesture', data[0]));
        // gestureChar.subscribe();

        const buttonChar = bluetoothDevice.getCharacteristic(SERVER_SERVICE_UUID, BUTTON_CHAR_UUID);
        buttonChar.on('data', (data) => {
            log('on button', data[0]);
            // bluetoothDevice.switchScreenOnOff();
        });
        buttonChar.subscribe();
    });
}

let bluetoothDevice: MicrooledDevice;
let port: SerialPort;
let connecting = false;
let glassesName; //= '23400000000';

function onDeviceMessage(device: MicrooledDevice, results: ParseResult[]) {
    results.forEach((result) => {
        if (result.message) {
            // console.log('received device message', result);
        } else if (result.state === ParsingState.ParsingPayload) {
            this.handleProgress(device, result.progressData);
        }
    });
}
const keypress = require('keypress');

const keyListeners = [];
function addKeyListener(listener) {
    const index = keyListeners.indexOf(listener);
    if (index === -1) {
        keyListeners.push(listener);
    }
}
function removeKeyListener(listener) {
    const index = keyListeners.indexOf(listener);
    if (index !== -1) {
        keyListeners.splice(index, 1);
    }
}

process.stdin.on('keypress', function (ch, key) {
    log('got "keypress"', JSON.stringify(key));
    if (!key) {
        return;
    }
    if (key.ctrl && key.name === 'c') {
        // log("killing app", key);
        try {
            player.stop();
        } catch (err) {}
        process.exit(0);
    } else {
        for (const item of keyListeners) {
            item(key);
        }
    }
});

keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume(); // so the program will not close instantly

async function connectSerial() {
    const result = await SerialPort.list();
    const microoledSerial = result.find((r) => r.vendorId && r.vendorId.toLowerCase() === 'fffe');
    if (microoledSerial) {
        console.log('microoledSerial', microoledSerial);
        port = new SerialPort(microoledSerial.path, {
            autoOpen: false,
            baudRate: 115200
        });
        port.on('readable', function () {
            log(
                'read on USB:',
                '"',
                port
                    .read()
                    .toString()
                    .replace(/[\n\r\t]+/gm, ' ')
                    .slice(0, -1),
                '"'
            );
        });
        port.open(function (err) {
            log('SerialPort opened', err);
            if (err) {
                return log('Error: ', err.message);
            }
        });
    }
}

function main() {
    if (connectThroughBLE) {
        noble.on('discover', (peripheral) => {
            if (!connecting && peripheral.advertisement) {
                const manufacturerId = peripheral.advertisement.manufacturerData && new DataView(new Uint8Array(peripheral.advertisement.manufacturerData).buffer, 0).getUint16(0, true);
                const name = peripheral.advertisement.localName;
                if (manufacturerId === 56058 || /Microoled/.test(name) || /Cobra/.test(name)) {
                    log('discovered', name, manufacturerId, peripheral.id, peripheral.advertisement.toString());
                    if (!glassesName || name.indexOf(glassesName) !== -1) {
                        ui.updateBottomBar(`connecting to your glasses ${name}`);
                        connecting = true;
                        noble.stopScanning();
                        // log('connecting to Glasses', name);
                        bluetoothDevice = new MicrooledDevice(peripheral);
                        bluetoothDevice.once('disconnected', () => {
                            connecting = false;
                            if (port) {
                                port.close();
                                port = null;
                            }
                            bluetoothDevice = null;
                        });
                        bluetoothDevice
                            .connect()
                            .then(() => {
                                connecting = false;
                                ui.updateBottomBar('');
                            })
                            .then(() => onGlassesConnected(peripheral))
                            .then(() => connectSerial())
                            .then(() => {
                                promptForAction();
                            });
                    }
                }
            }
        });

        noble.on('scanStart', () => {
            log('on scan start noble');
        });
        noble.on('scanStop', () => {
            log('on scan stop noble');
        });

        log('noble state', noble.state);
        noble.on('stateChange', function (state) {
            log('noble state change', state);
            if (state === 'poweredOn') {
                log('starting noble scan');
                noble.startScanning([], true);
            }
        });
    } else {
        connectSerial();
    }
}

function readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, { encoding: 'latin1' }, (err, r) => {
            log('readFile ', typeof r, r && r.length, err);
            if (err) {
                reject(err);
            } else {
                resolve(r);
            }
        });
    });
}

function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}
function sendLayoutConfigSerial(filePath: string) {
    if (!filePath || filePath.length === 0) {
        throw new Error(`wrong file path: ${filePath}`);
    }
    const spinner = ora(`sending layout: ${filePath}`).start();
    return readFile(filePath)
        .then((r) => {
            const toSend = r.split('\n');
            // log('about to send', toSend.length);
            let done = 0;
            let promise = Promise.resolve(undefined);
            toSend.forEach((s) => {
                promise = promise.then(function () {
                    return new Promise<void>((resolve, reject) => {
                        // log('sending', s);
                        setTimeout(function () {
                            port.write(s + '\r\n', (err, bytesWritten) => {
                                if (err) {
                                    return reject(err);
                                }
                                done++;
                                spinner.text = `sending layout(${Math.round((done / toSend.length) * 100)}%): ${filePath}`;
                                resolve();
                            });
                        }, 500);
                    });
                });
            });
            return promise;
        })
        .then(() => {
            spinner.succeed('layout data sent!');
        })
        .catch((err) => {
            spinner.fail(err);
        });
}

async function sendRawCommands(commandsToSend: number[][], message) {
    const spinner = ora(`${message}`).start();
    try {
        const datalength = commandsToSend.reduce((accumulator, currentValue) => accumulator + currentValue.length, 0);
        let dataSent = 0;
        spinner.text = `${message}(0%)`;
        const startTime = Date.now();

        const promisedCallback = (resolve, reject) => (err, progress, total) => {
            if (err) {
                return reject(err);
            }
            const p = (progress * total + dataSent) / datalength;
            spinner.text = `${message}(${Math.round(p * 100)}%, ${datalength},  ${Date.now() - startTime} ms)`;
            if (progress === 1) {
                dataSent += total;
                resolve();
            }
        };

        const createPromise = () =>
            new Promise((resolve, reject) => {
                const currentCommandToSend = commandsToSend.shift();
                // console.log('currentCommandToSend', commandsToSend.length, JSON.stringify(currentCommandToSend));
                bluetoothDevice.sendBinaryCommand(CommandType.RawCommand, {
                    params: [currentCommandToSend],
                    progressCallback: promisedCallback(resolve, reject)
                });
            }).then(() => {
                if (commandsToSend.length > 0) {
                    return createPromise();
                }
            });
        await createPromise();
        // console.log('finished sendRawCommands');
        bluetoothDevice.clearFullScreen();
        spinner.succeed('sendRawCommands sent!');
    } catch (err) {
        console.log('catched sendRawCommands error', err);
        spinner.fail(err);
    } finally {
        setTimeout(() => {
            spinner.stop();
        }, 500);
    }
}
async function sendLayoutConfig(filePath: string) {
    const r = await readFile(filePath);
    const commandsToSend = r
        .split('\n')
        .filter((s) => s && s.trim().length > 0)
        .map(hexToBytes);
    return sendRawCommands(commandsToSend, `sending layout: ${filePath}`);
}

function promptForAction() {
    try {
        player.stop();
    } catch (error) {}

    inquirer
        .prompt([
            {
                type: 'list',
                name: 'command',
                message: 'Connected to Glasses, what do you want to do?',
                choices: [
                    'storyDemo',
                    'startDemo',
                    'sendBitmap',
                    'testBitmap',
                    'streamImage',
                    'sendBitmapFolder',
                    'sendBitmapConfig',
                    'sendBitmapConfigSerial',
                    'bmplist',
                    'memory',
                    'nbConfigs',
                    'cfgList',
                    'deleteCfg',
                    'reset',
                    'exit'
                ]
            }
        ])
        .then(async (promptAnswers: { command: string }) => {
            try {
                if (promptAnswers) {
                    process.stdin.setRawMode(true);
                    process.stdin.resume(); // so the program will not close instantly
                    console.log('handling command', promptAnswers.command);
                    switch (promptAnswers.command) {
                        case 'exit':
                            process.exit(0);
                            break;
                        // case 'sendBitmap': {
                        //     const filePath = path.join(__dirname, storiesFolder, 'zr_test2.png');
                        //     const [data, x, y] = createBitmapData(filePath);
                        //     await bluetoothDevice.sendWriteConfig(CONFIG_PARAMS);
                        //     await sendRawCommands(data, `sending bitmap: ${filePath}`);
                        //     await bluetoothDevice.sendReadConfig(2);
                        //     promptForAction();
                        //     break;
                        // }
                        case 'buildFolderData':
                            const { data } = buildDataSet(configId);
                            promptForAction();
                            break;
                        case 'sendBitmapFolder': {
                            // const configId = 'nav';
                            const { data, files } = buildDataSet(configId);
                            const start = Date.now();
                            await sendRawCommands(data, 'sending bitmaps:');
                            console.log(`sent ${files.length} images in`, Date.now() - start, 'ms');
                            const resultMem = await bluetoothDevice.sendBinaryCommand(CommandType.cfgFreeSpace, { timestamp: Date.now() });
                            console.log('memory:', resultMem.data);

                            const result = await bluetoothDevice.sendBinaryCommand(CommandType.cfgList, { timestamp: Date.now() });
                            console.log('configs:', result.data);
                            // await bluetoothDevice.sendReadConfig(2);
                            promptForAction();
                            break;
                        }
                        case 'sendBitmapConfig': {
                            const filePath = getFolder(configId);
                            sendLayoutConfig(path.join(filePath, 'images.txt')).then(promptForAction);
                            break;
                        }
                        case 'streamImage': {
                            const filePath = getFolder(configId);
                            streamImage(path.join(filePath, 'test.png')).then(promptForAction);
                            break;
                        }
                        case 'sendBitmapConfigSerial': {
                            const filePath = getFolder(configId);
                            sendLayoutConfigSerial(path.join(filePath, 'images.txt')).then(promptForAction);
                            break;
                        }
                        case 'bmplist': {
                            const result = await bluetoothDevice.sendBinaryCommand(CommandType.BmpList, { timestamp: Date.now() });
                            console.log(result);
                            promptForAction();
                            break;
                        }
                        case 'memory': {
                            const result = await bluetoothDevice.sendBinaryCommand(CommandType.cfgFreeSpace, { timestamp: Date.now() });
                            console.log(result);
                            promptForAction();
                            break;
                        }
                        case 'nbConfigs': {
                            const result = await bluetoothDevice.sendBinaryCommand(CommandType.NbConfigs, { timestamp: Date.now() });
                            console.log(result);
                            promptForAction();
                            break;
                        }
                        case 'cfgList': {
                            const result = await bluetoothDevice.sendBinaryCommand(CommandType.cfgList, { timestamp: Date.now() });
                            console.log(result);
                            promptForAction();
                            break;
                        }
                        case 'reset': {
                            bluetoothDevice.sendBinaryCommand(CommandType.DeleteBmp, { params: [0xff] });
                            promptForAction();
                            break;
                        }
                        case 'deleteCfg': {
                            bluetoothDevice.sendBinaryCommand(CommandType.cfgDelete, { params: { name: configId } });
                            bluetoothDevice.sendBinaryCommand(CommandType.cfgList);
                            promptForAction();
                            break;
                        }

                        case 'startDemo': {
                            startDemo(0, 8);
                            break;
                        }

                        case 'testBitmap': {
                            // const configId = 'nav';
                            await bluetoothDevice.sendBinaryCommand(CommandType.cfgSet, { params: { name: configId } });
                            let imageID = 0;
                            await bluetoothDevice.sendBinaryCommand(CommandType.Dim, { params: [70] });
                            await bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });
                            // await bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });

                            function handleKey(key) {
                                switch (key.name) {
                                    case 'left':
                                        imageID = Math.max(imageID - 1, 0);
                                        bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });
                                        // bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });
                                        break;
                                    case 'right':
                                        imageID++;
                                        bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });
                                        // bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageID, 0, 0] });
                                        break;
                                    case 'escape':
                                        removeKeyListener(handleKey);
                                        promptForAction();
                                }
                            }
                            addKeyListener(handleKey);

                            break;
                        }

                        case 'storyDemo':
                            await storyDemo();
                            promptForAction();
                            break;
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });
}
function dec2bin(dec) {
    return (dec >>> 0).toString(2);
}

function streamImage(filePath: string) {
    const gray = cv2.imread(filePath).rotate(cv2.ROTATE_180).cvtColor(cv2.COLOR_BGR2GRAY);
    const imgHeight = gray.sizes[0];
    const imgWidth = gray.sizes[1];
    const commandsToSend = [[0xff, 0x44, 0x00, 0x0f].concat(pictureDimensionToByteArray(imgHeight, imgWidth)).concat([0x00, 0x00, 0x00, 0x00, 0xaa])];
    let commandToSend = [];
    let writeValueForStatus;
    let val = 0;
    let cptImg = 0;
    for (let i = 0; i < imgHeight; i++) {
        for (let j = 0; j < imgWidth; j++) {
            const pixel = gray.at(i, j);
            const modulo = cptImg % 8;
            if (modulo === 7) {
                commandToSend.push(val);
                val = 0;
                if (commandToSend.length >= 100) {
                    commandToSend.unshift(0xff, 0x44, 0x00, commandToSend.length + 5);
                    commandToSend.push(0xaa);
                    commandsToSend.push(commandToSend);
                    commandToSend = [];
                }
            } else {
                val = val | ((pixel > 128 ? 1 : 0) << modulo);
            }
            cptImg++;
        }
    }
    if (commandToSend.length > 0) {
        commandToSend.unshift(0xff, 0x44, 0x00, commandToSend.length + 5);
        commandToSend.push(0xaa);
        commandsToSend.push(commandToSend);
        commandToSend = [];
    }
    // return commandsToSend;
    // console.log(commandsToSend);
    return sendRawCommands(commandsToSend, `streaming bitmap: ${filePath}`);
}

// function cropAndResize(filePath: string, negate = false) {
//     let gray = cv2.imread(filePath).resize(228, 192).rotate(cv2.ROTATE_180).cvtColor(cv2.COLOR_BGR2GRAY);
//     if (negate) {
//         gray = gray.bitwiseNot();
//     }
//     //find crop zone
// }

async function startLoop(index: number) {
    // console.log('startLoop', index);
    await bluetoothDevice.sendBinaryCommand(CommandType.Clear);
    await bluetoothDevice.sendBinaryCommand(CommandType.Dim, { params: [0] });
    await delay(50); // ms
}
async function fadein() {
    for (let i = 0; i < 20; i++) {
        await delay(100); // ms
        await bluetoothDevice.sendBinaryCommand(CommandType.Dim, { params: [i * 5] });
    }
}
// async function stopLoop(index: number) {
//     console.log('stopLoop', index);
// }
async function fadeout() {
    for (let i = 20; i >= 0; i--) {
        await delay(100); // ms
        await bluetoothDevice.sendBinaryCommand(CommandType.Dim, { params: [i * 5] });
    }
}

async function demoLoop(bmpIndex: number, count = 3, pauseOnFirst = false) {
    for (let index = 0; index < count; index++) {
        // await bluetoothDevice.sendBinaryCommand(CommandType.Clear);
        await bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [bmpIndex + index, 0, 0] });
        // await bluetoothDevice.sendBinaryCommand(CommandType.Bitmap, { params: [bmpIndex + index, 0, 0] });
        await delay(pauseOnFirst && index === 0 ? 1000 : 200);
    }
}

async function startDemo(index: number, count = 3) {
    // console.log('startDemo', index);
    // Oeil
    isInDemo = true;
    function handleKey(key) {
        if (key.name === 's') {
            log('got s key', isInDemo);
            if (isInDemo) {
                isInDemo = false;
                // } else {
                // startSession();
            }
        }
    }
    addKeyListener(handleKey);
    await startLoop(index);
    fadein();
    let loopIndex = 0;
    while (isInDemo) {
        await demoLoop(index, count, loopIndex % 2 === 0);
        loopIndex++;
    }
    removeKeyListener(handleKey);
    await fadeout();
    promptForAction();
}

function parseLottieFile(data: any) {
    const assets = {};
    data.assets.forEach((a) => {
        assets[a.id] = a.layers;
    });
    const timeline = [];
    let lastOp;
    function addData(data, start = 0, end = 0) {
        // timeline[Math.round(((data.ip + start) * 1000) / 24)] = data.nm;
        const newStart = Math.round(((data.ip + start) * 1000) / 24);
        const last = timeline.length > 1 && timeline[timeline.length - 1];
        if (last && (timeline[timeline.length - 1].time >= newStart || newStart - timeline[timeline.length - 1].time <= 50)) {
            timeline.splice(timeline.length - 1, 1);
        }
        if (!last || last.text !== data.nm) {
            timeline.push({
                time: Math.round(((data.ip + start) * 1000) / 24),
                text: data.nm
            });
        }
        if (end) {
            timeline.push({
                time: Math.round((Math.min(data.op + start, end) * 1000) / 24),
                text: ''
            });
        } else {
            timeline.push({
                time: Math.round(((data.op + start) * 1000) / 24),
                text: ''
            });
        }
    }
    data.layers.forEach((l) => {
        if (assets[l.refId]) {
            assets[l.refId].every((d) => {
                if (d.ip < l.op - l.ip) {
                    addData(d, l.ip, l.op);
                    return true;
                } else {
                    return false;
                }
            });
        } else {
            addData(l);
        }
    });
    return timeline;
}
async function storyDemo() {
    try {
        const storyFolder = getFolder(configId);
        console.log('storyFolder', storyFolder);
        const data = await readFile(path.join(storyFolder, 'composition.json'));
        const imagesMap = JSON.parse(await readFile(path.join(storyFolder, 'image_map.json')));
        const result = parseLottieFile(JSON.parse(data));
        await bluetoothDevice.sendBinaryCommand(CommandType.cfgSet, { params: { name: configId } });
        await bluetoothDevice.sendBinaryCommand(CommandType.Dim, { params: [100] });

        const lyric = new Lyric({
            lines: [{ time: 0, text: '' }].concat(result),
            onPlay: async (line, text) => {
                if (text && text.length > 0) {
                    const cleaned = text.split('.')[0].replace(/\s/g, '-');
                    // const cleaned = text.split('.')[0];
                    if (imagesMap[cleaned]) {
                        const [imageId, x, y] = imagesMap[cleaned];
                        if (imageId) {
                            bluetoothDevice.sendBinaryCommand(CommandType.imgDisplay, { params: [imageId, x, y] });
                        } else {
                            bluetoothDevice.clearScreen();
                        }
                    } else {
                        console.error('missing image', text, cleaned);
                    }
                } else {
                    // console.log('clear screen');
                    bluetoothDevice.clearScreen();
                }
            }
        });
        await new Promise((resolve) => {
            player
                .play({
                    path: path.join(storyFolder, 'audio.mp3'),
                    sync: true
                })
                .then(resolve);
            lyric.play();
        });
    } catch (error) {
        console.error(error);
    }
}
