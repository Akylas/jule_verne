import { File } from '@nativescript/core';
import { Bluetooth, StartScanningOptions as IStartScanningOptions, Peripheral, ReadResult, StartNotifyingOptions } from '@nativescript-community/ble';
import { isSimulator } from '@nativescript-community/extendedinfo';
import { AdditiveTweening } from 'additween';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { Folder, knownFolders, path } from '@nativescript/core/file-system';
import { TNSPlayer } from '@akylas/nativescript-audio';
import { GeoHandler, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { $t, $tc } from '~/helpers/locale';
import { MessageError } from '~/services/CrashReportService';
import { versionCompare } from '~/utils';
import { alert, confirm } from '~/utils/dialogs';
import { Characteristic } from './bluetooth/Characteristic';
import { GlassesDevice } from './bluetooth/GlassesDevice';
import Lyric from './Lyric';
import { CommandType, InputCommandType, Message } from './Message';
import { getGlassesImagesFolder } from '~/utils/utils';

export { Peripheral };

export const MICROOLED_MANUFACTURER_ID = 0x08f2;
export const MICROOLED_MANUFACTURER_NAME = 'Microoled';

export const SPOTA_SERVICE_UUID = '0000fef5-0000-1000-8000-00805f9b34fb';
export const SPOTA_PATCH_LEN_UUID = '9d84b9a3-000c-49d8-9183-855b673fda31';
export const SPOTA_PATCH_DATA_UUID = '457871e8-d516-4ca1-9116-57d0b17b9cb2';
export const SPOTA_SERV_STATUS_UUID = '5f78df94-798c-46f5-990a-b3eb6a065c88';
export const CLIENT_CONFIG_DESCRIPTOR = '00002902-0000-1000-8000-00805f9b34fb';
export const SUOTA_VERSION_UUID = '64B4E8B5-0DE5-401B-A21D-ACC8DB3B913A';
export const SPOTA_MEM_DEV_UUID = '8082CAA8-41A6-4021-91C6-56F9B954CC34';
export const SPOTA_GPIO_MAP_UUID = '724249F0-5EC3-4B5F-8804-42345AF08651';
export const SUOTA_PATCH_DATA_CHAR_SIZE_UUID = '42C3DFDD-77BE-4D9C-8454-8F875267FB3B';
export const SUOTA_MTU_UUID = 'B7DE1EEA-823D-43BB-A3AF-C4903DFCE23C';
export const SUOTA_L2CAP_PSM_UUID = '61C8849C-F639-4765-946E-5C3419BEBB2A';

export const SERVER_SERVICE_UUID = '0783b03e-8535-b5a0-7140-a304d2495cb7';
export const TX_SERVER_UUID = '0783b03e-8535-b5a0-7140-a304d2495cb8';
export const RX_SERVER_UUID = '0783b03e-8535-b5a0-7140-a304d2495cba';
export const FLOW_SERVER_UUID = '0783b03e-8535-b5a0-7140-a304d2495cb9';

export const BATTERY_UUID = '180f';
export const BATTERY_DESC_UUID = '2a19';
export const CONTROL_CHAR = String.fromCharCode(0);
const SPACE_CHAR = String.fromCharCode(181); // µ

const SPS_FLOW_CONTROL_ON = 0x01;
const SPS_FLOW_CONTROL_OFF = 0x02;
const SPS_FLOW_CONTROL_ERROR = 0x03;

export const DEFAULT_MTU = 20;
export const DEFAULT_WRITE_TIMEOUT = 0;

export const FinishSendingEvent = 'finishSending';
export const StatusChangedEvent = 'status';
export const GlassesConnectedEvent = 'glassesConnected';
export const BLEConnectedEvent = 'connected';
export const GlassesDisconnectedEvent = 'glassesDisconnected';
export const GlassesReconnectingEvent = 'GlassesReconnecting';
export const GlassesReconnectingFailedEvent = 'GlassesReconnectingFailed';
export const BLEDisconnectedEvent = 'disconnected';
export const GlassesBatteryEvent = 'glassesBattery';
export const GlassesScreenChangeEvent = 'glassesScreenChange';
export const GlassesScreenStateChangeEvent = 'glassesScreenStateChange';
export const VersionEvent = 'version';
export const SerialEvent = 'serial';
export const GlassesSettingsEvent = 'settings';
export const DevLogMessageEvent = 'devlogmessage';

export function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function shuffleArray(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

function getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function hexToBytes(hex) {
    const bytes = [];
    for (let c = 2; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// function pictureDimensionToByteArray(height, width) {
//     const result = [];

//     const size = height * Math.ceil(width / 2);

//     result.push((size & 0xff000000) >> 24);
//     result.push((size & 0xff0000) >> 16);
//     result.push((size & 0xff00) >> 8);
//     result.push(size & 0xff);

//     result.push((width & 0xff00) >> 8);
//     result.push(width & 0xff);
//     return result;
// }

// function createBitmapData(filePath: string) {
//     const mat = cv2.Imgcodecs.imread(filePath);
//     cv2.Core.rotate(mat, mat, cv2.Core.ROTATE_180);
//     cv2.Imgproc.cvtColor(mat, mat, cv2.Imgproc.COLOR_RGB2GRAY);
//     const imgHeight = mat.size().height;
//     const imgWidth = mat.size().width;
//     let cptImg = 0;
//     const commandsToSend = [[0xff, 0x41, 0x00, 0x0b].concat(pictureDimensionToByteArray(imgHeight, imgWidth)).concat([0xaa])];
//     let commandToSend = [];
//     let val0;
//     for (let i = 0; i < imgHeight; i++) {
//         for (let j = 0; j < imgWidth; j++) {
//             // const pixel = mat.(i, j);
//             const pixel = mat[j][i];
//             if (cptImg % 2 === 0) {
//                 if (pixel < 16 && pixel > 0) {
//                     val0 = 0;
//                 } else {
//                     val0 = Math.floor(pixel / 16);
//                 }
//             } else {
//                 let valShifted;
//                 if (pixel < 16 && pixel > 0) {
//                     valShifted = 0;
//                 } else {
//                     valShifted = Math.floor(pixel / 16);
//                 }
//                 const val = valShifted * 16 + val0;
//                 commandToSend.push(val);
//                 if (commandToSend.length >= 100) {
//                     commandToSend.unshift(0xff, 0x41, 0x00, commandToSend.length + 5);
//                     commandToSend.push(0xaa);
//                     commandsToSend.push(commandToSend);
//                     commandToSend = [];
//                 }
//             }

//             cptImg += 1;
//         }

//         if (imgWidth % 2) {
//             commandToSend.push(val0);
//         }
//     }
//     if (commandToSend.length > 0) {
//         commandToSend.unshift(0xff, 0x41, 0x00, commandToSend.length + 5);
//         commandToSend.push(0xaa);
//         commandsToSend.push(commandToSend);
//         commandToSend = [];
//     }
//     return commandsToSend;
// }

export let bluetooth: Bluetooth;

export interface StartScanningOptions extends IStartScanningOptions {
    glasses?: boolean;
}

export interface BLEEventData extends EventData {
    data: any;
}
export interface BLEBatteryEventData extends BLEEventData {
    data: number;
}

export interface BLEConnectionEventData extends BLEEventData {
    data: Peripheral;
    manualDisconnect?: boolean;
}
export interface BLEStatusEventData extends BLEEventData {
    data: { state: 'on' | 'off' | 'unsupported' };
}

export interface GlassesConnectionEventData extends BLEEventData {
    data: GlassesDevice;
    manualDisconnect?: boolean;
}

export interface ProgressListener {
    total: number;
    current: number;
    onProgress(err: Error, progress: number, total: number);
}

export interface GlassesSettings {
    shift: {
        x: number;
        y: number;
    };

    luma: number;
    als: boolean;
    gesture: boolean;
}
export type ProgressCallback = (error: Error, progress: number, total: number) => void;
function ensurePadding(value: string, length: number) {
    if (value.length < length) {
        value = SPACE_CHAR.repeat(length - value.length) + value;
    }
    return value;
}

interface BluetoothEvent extends EventData {
    data: any;
}
interface BluetoothDeviceEvent extends BluetoothEvent {
    data: Peripheral;
}

const TAG = '[Bluetooth]';

export class BluetoothHandler extends Observable {
    savedGlassesUUID = appSettings.getString('savedGlassesUUID');
    savedGlassesName = appSettings.getString('savedGlassesName');
    savedExternalUUIDs: { UUID: string; type: string; name: string; layouts: number[]; filterUUID: string }[] = JSON.parse(appSettings.getString('savedExternalUUIDs', '[]'));
    mImperialUnit = appSettings.getBoolean('unit_imperial', false);
    glasses: GlassesDevice;
    glassesBattery = -1;
    connectingDevicesUUIDs: { [k: string]: { autoStart?: boolean } } = {};
    connectingToSavedGlasses = false;
    manualDisconnect: { [k: string]: boolean } = {};
    _devMode = false;

    geoHandler: GeoHandler;

    devLog: Message<any>[];

    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
        if (this._devMode) {
            this.devLog = [];
        }
    }
    constructor() {
        super();

        if (!bluetooth) {
            bluetooth = new Bluetooth('myCentralManagerIdentifier');
        }
    }
    log(...args) {
        console.log('[BluetoothHandler]', ...args);
    }

    async stop() {
        DEV_LOG && console.log('BLE', 'stop');
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        this.stopScanning();
        this.connectingToSavedGlasses = false;
        await this.disconnectGlasses(true);

        bluetooth.off(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.off(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.off(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);

        // we clear the bluetooth module on stop or it will be in a bad state on restart (not forced kill) on android.
        bluetooth = null;
        DEV_LOG && console.log('BLE', 'stop done');
    }
    start() {
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        bluetooth.on(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.on(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.on(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);
    }
    bluetoothState = 'off';
    onBLEStatusChange(e: BluetoothEvent) {
        const state = e.data.state;
        if (this.bluetoothState !== state) {
            this.bluetoothState = state;
            if (state === 'off') {
                // say manual disconnect not to try and connect again
                this.cancelConnections();
                if (this.glasses) {
                    const glasses = this.glasses;
                    this.disconnectGlasses(true);
                    this.onDeviceDisconnected({ data: glasses } as any);
                }
            }
            this.notify({
                eventName: StatusChangedEvent,
                object: this,
                data: e['data']
            });
        }
    }
    hasSavedGlasses() {
        return !this.glasses && !!this.savedGlassesUUID;
    }
    isConnectingToDeviceUUID(UUID: string) {
        return this.connectingDevicesUUIDs[UUID] !== undefined;
    }
    get connectingToGlasses() {
        return this.isConnectingToDeviceUUID(this.savedGlassesUUID);
    }
    connectToSavedGlasses(): Promise<boolean> {
        let foundGlasses = false;
        return new Promise((resolve, reject) => {
            this.startScanning({
                seconds: 10,
                onDiscovered: (data) => {
                    if (this.connectingToGlasses || !data.advertismentData || !data.localName) {
                        return;
                    }
                    if (data.UUID === this.savedGlassesUUID && !this.isConnectingToDeviceUUID(data.UUID)) {
                        // console.log('connectToSaved', 'discovered glasses', data.UUID, data.name);
                        this.stopScanning();
                        this.connect(this.savedGlassesUUID)
                            .then(() => {
                                // console.log(TAG, 'connectToSavedGlasses', 'found glasses', data.UUID);
                                foundGlasses = true;
                                resolve(foundGlasses);
                            })
                            .catch(reject);
                    }
                }
            }).then(() => {
                // console.log(TAG, 'connectToSavedGlasses', 'done', foundGlasses, this.isConnectingToDeviceUUID(this.savedGlassesUUID));
                // if (!foundGlasses) {
                //     reject();
                // }
                if (!this.connectingToGlasses) {
                    resolve(foundGlasses);
                }
            });
        });
    }

    cancelConnections() {
        console.log(TAG, 'cancelConnections');
        if (this.connectingToGlasses) {
            this.stopScanning();
        }
        Object.keys(this.connectingDevicesUUIDs).forEach((k) => this.disconnect(k, true));
    }
    async connectToSaved() {
        if (!this.connectingToGlasses && !this.glasses && !!this.savedGlassesUUID) {
            console.log(TAG, 'connectToSaved', 'start', this.savedGlassesUUID);
            try {
                if (__ANDROID__) {
                    await this.geoHandler.enableLocation();
                }
                if (!this.glasses && !!this.savedGlassesUUID) {
                    const found = await this.connectToSavedGlasses();
                }
                return this.connectingToGlasses || !!this.glasses;
            } catch (err) {
                return Promise.reject(err);
            }
        } else {
            return this.connectingToGlasses || !!this.glasses;
        }
    }

    stopClearScreenTimer;
    private onSessionStateEvent(e: SessionEventData) {
        if (e.data.state === SessionState.STOPPED) {
            if (this.glasses) {
                this.clearFullScreen();
                this.sendText(200, 128, 4, 1, 15, 'session stopped');
                this.stopClearScreenTimer = setTimeout(() => {
                    this.clearFullScreen();
                }, 3000);
            }
        } else if (e.data.state === SessionState.RUNNING) {
            // prevent session to start with "black screen"
            // if (this.isBlackPage(this.currentPage)) {
            // this.setPage(0);
            // } else {
            this.clearFullScreen();
            // this.refreshScreen(true);
            // }
        }
    }

    isEnabled() {
        if (isSimulator()) {
            return Promise.resolve(false);
        }
        return bluetooth.isBluetoothEnabled();
    }

    enable() {
        if (isSimulator()) {
            // return Promise.resolve();
            return Promise.reject('running in simulator');
        }
        return bluetooth.enable().then((enabled) => {
            if (!enabled) {
                if (__IOS__) {
                    alert({
                        title: $tc('bluetooth_not_enabled'),
                        okButtonText: $t('ok')
                    });
                } else {
                    return confirm({
                        message: $tc('bluetooth_not_enabled'),
                        okButtonText: $t('cancel'), // inversed buttons
                        cancelButtonText: $t('settings')
                    })
                        .then((result) => {
                            if (!result) {
                                return bluetooth.openBluetoothSettings();
                            }
                        })
                        .catch((err) => {});
                }

                return Promise.reject(undefined);
            }
        });
    }

    async onDeviceConnected(e: BluetoothDeviceEvent) {
        const data = e.data;
        const options = this.connectingDevicesUUIDs[data.UUID];
        // console.log(TAG, 'onDeviceConnected but not discovered', data.UUID, data.name, data.localName, data.advertismentData);
        try {
            const result = await bluetooth.discoverAll({ peripheralUUID: data.UUID });
            // we do the discovery ourself so copy it
            data.services = result.services;
            console.log(
                TAG,
                'onDeviceConnected',
                data.UUID,
                data.services.map((s) => s.UUID)
            );
            const index = data.services.findIndex((s) => s.UUID.toLowerCase() === SERVER_SERVICE_UUID);
            if (index !== -1) {
                // these are the glasses!
                (data as any).isMicrooled = true;
                this.isScreenOn = true;
                this.needsPowerOn = true;
                this.savedGlassesUUID = data.UUID;
                // if the session is paused it must have been an unwanted disconnection
                // dont change the user page

                const glasses = (this.glasses = new GlassesDevice(data, this));

                this.savedGlassesName = this.glasses.localName;
                appSettings.setString('savedGlassesUUID', this.savedGlassesUUID);
                appSettings.setString('savedGlassesName', this.savedGlassesName);

                // console.log('about start startNotifying ', this.savedGlassesUUID);
                await glasses.listenForMessage();

                glasses.on('message', this.onGlassesMessage.bind(this));
                glasses.on('swipe', this.onGlassesGesture.bind(this));
                glasses.on('tap', this.onGlassesTap.bind(this));

                await this.requestMtu();

                if (this.glasses.hasFlowControl) {
                    await Characteristic.startNotifying(glasses.UUID, SERVER_SERVICE_UUID, FLOW_SERVER_UUID, this.onFlowControlReading.bind(this));
                }
                await Characteristic.startNotifying(glasses.UUID, BATTERY_UUID, BATTERY_DESC_UUID, this.onBatteryReading.bind(this));
                await this.readFirmwareVersion();
                await this.readSerialNumber();
                await this.readBattery();
                if (this.glasses) {
                    // ensure we are still connected here
                    this.notify({
                        eventName: GlassesConnectedEvent,
                        object: this,
                        data: glasses
                    } as BLEEventData);
                } else {
                    return;
                }

                //this needs to be done after reading the firmware version so we now if we support settings
                if (this.glasses.supportSettings) {
                    this.askSettings();
                } else {
                    this.activateSensor(this.isSensorOn);
                    this.activateGesture(this.isGestureOn);
                    this.changeLuminance(this.levelLuminance);
                }
                this.askConfigs();
                this.sendDim(100);
                this.setConfig('nav');
                this.clearScreen();
            }
            this.removeConnectingDeviceUUID(data.UUID);
            this.notify({
                eventName: BLEConnectedEvent,
                object: this,
                data
            } as BLEEventData);
        } catch (e) {
            console.error(e.toString());
            this.disconnect(data.UUID, false);

            // make sure the error is shown in the UI
            // setTimeout(() => {
            //     throw e;
            // }, 0);
        }
    }

    onDeviceDisconnected(e: BluetoothDeviceEvent) {
        const data = e.data;
        console.log(TAG, 'onDeviceDisconnected', !!this.glasses, this.glasses && data.UUID === this.glasses.UUID);
        this.removeConnectingDeviceUUID(data.UUID);

        if (this.glasses && data.UUID === this.glasses.UUID) {
            this.geoHandler.setReadableStories(null);
            this.glasses.onDisconnected();
            this.glasses = null;
            bluetooth.isBluetoothEnabled().then((enabled) => {
                const manualDisconnect = !!this.manualDisconnect[data.UUID] || !enabled;
                this.notify({
                    eventName: GlassesDisconnectedEvent,
                    object: this,
                    manualDisconnect,
                    data
                } as BLEConnectionEventData);
                if (!manualDisconnect) {
                    this.notify({
                        eventName: GlassesReconnectingEvent,
                        object: this
                    });
                    console.log(TAG, 'glasses disconnected after error, trying to reconnect');
                    timeout(5000)
                        .then(() => this.connectToSaved())
                        .then((result) => {
                            if (!result) {
                                return timeout(10000).then(() => this.connectToSaved());
                            }
                            return result;
                        })
                        .then((result) => {
                            if (!result) {
                                return timeout(10000).then(() => this.connectToSaved());
                            }
                            return result;
                        })
                        .then((result) => {
                            if (!result) {
                                return timeout(10000).then(() => this.connectToSaved());
                            }
                            return result;
                        })
                        .then((result) => {
                            console.log(TAG, 'glasses reconnection done', result);
                            if (!result) {
                                this.notify({
                                    eventName: GlassesReconnectingFailedEvent,
                                    object: this
                                });
                            }
                        });
                } else {
                    delete this.manualDisconnect[data.UUID];
                }
            });
        }

        this.notify({
            eventName: BLEDisconnectedEvent,
            object: this,
            data
        } as BLEEventData);
    }
    removeConnectingDeviceUUID(UUID: string) {
        const options = this.connectingDevicesUUIDs[UUID];
        delete this.connectingDevicesUUIDs[UUID];
        return options;
    }
    async connect(UUID: string, options = {}) {
        console.log('connect', UUID, options);
        try {
            this.connectingDevicesUUIDs[UUID] = options;
            await bluetooth.connect({
                UUID,
                autoDiscoverAll: false
            });
        } catch (err) {
            this.removeConnectingDeviceUUID(UUID);
            console.error(`Failed to  connect to device ${UUID}: ${err}`);
            throw err || new MessageError({ message: 'device_connection_failed', UUID });
        }
    }
    disconnect(UUID: string, manualDisconnect = true) {
        this.manualDisconnect[UUID] = manualDisconnect;
        return bluetooth.disconnect({
            UUID
        });
    }

    async disconnectGlasses(manualDisconnect?: boolean): Promise<void> {
        DEV_LOG && console.log(TAG, 'disconnectGlasses', manualDisconnect, !!this.glasses);
        if (this.glasses) {
            await new Promise<any>((resolve, reject) => {
                this.once(GlassesDisconnectedEvent, resolve);
                return this.disconnect(this.glasses.UUID, manualDisconnect);
            });
        }
    }

    startScanning(options: StartScanningOptions) {
        return this.enable().then(() => {
            const defaultOptions: StartScanningOptions = {
                skipPermissionCheck: false,
                seconds: 4
            };
            return bluetooth.startScanning(Object.assign(defaultOptions, options));
        });
    }

    stopScanning() {
        return bluetooth.stopScanning();
    }
    startNotifying(params: StartNotifyingOptions) {
        return bluetooth.startNotifying(params);
    }

    onGlassesGesture() {}
    onGlassesTap() {
        // we ignore taps now
        // this.switchScreenOnOff();
    }

    addDevLogMessage(message: Message<any>) {
        if (DEV_LOG && this.devMode) {
            this.devLog.push(message);
            // console.log('addDevLogMessage', message);
            if (this.devLog.length > 500) {
                this.devLog.shift();
            }
            this.notify({
                eventName: DevLogMessageEvent,
                object: this,
                data: message
            });
        }
    }

    onGlassesMessage({ message }: { message: Message<any> }) {
        // this.addDevLogMessage(message);
        switch (message.commandType) {
            case CommandType.cfgList:
                const list = (message as Message<CommandType.cfgList>).data;
                this.geoHandler.setReadableStories(
                    list
                        .map((c) => parseInt(c.name, 10))
                        .filter((s) => !isNaN(s))
                        .sort()
                );
                break;
            case CommandType.Settings:
                const settings = (this.glasses.settings = (message as Message<CommandType.Settings>).data);
                this.notify({
                    eventName: GlassesSettingsEvent,
                    object: this,
                    data: settings
                });
                this.levelLuminance = settings.luma;
                this.isGestureOn = this.glasses.gestureOn = settings.gesture;
                this.isSensorOn = this.glasses.alsOn = settings.als;
                break;
        }
    }

    public sendCommand<T extends CommandType>({ command, params, progressCallback, timestamp }: { timestamp?: number; command: T; params?: InputCommandType<T>; progressCallback?: ProgressCallback }) {
        if (!this.glasses) {
            return;
        }
        // if (DEV_LOG) {
        //     console.log(TAG, 'sendCommandToGlass', this.glasses.binaryFormat, command, params);
        // }
        return this.glasses.sendCommand(command, { params, progressCallback, timestamp });
    }

    needsPowerOn = true;
    isScreenOn = true;
    isSensorOn = true;
    isGestureOn = true;
    levelLuminance = 10;
    _player = new TNSPlayer();

    createPlayer() {
        this._player = new TNSPlayer();
    }
    setScreenOn(value) {
        if (this.isScreenOn === value) {
            return false;
        }
        // console.log('setScreenOn', value);
        this.isScreenOn = value;

        if (this.isScreenOn) {
            // if (this.isBlackPage(this.currentPage)) {
            //     this.setNextPage();
            // } else {
            //     this.displayInterface(this.currentPage, true);
            // }
        } else {
            this.needsPowerOn = true;
            // console.log('power off');
            this.sendCommand({ command: CommandType.Power, params: ['off'] });
            // this.clearFullScreen();
        }
        this.notify({
            eventName: GlassesScreenStateChangeEvent,
            object: this,
            data: this.isScreenOn
        });
        return true;
    }

    switchScreenOnOff() {
        this.setScreenOn(!this.isScreenOn);
    }

    async clearFullScreen() {
        if (!this.glasses) {
            return;
        }
        if (this.stopClearScreenTimer) {
            clearTimeout(this.stopClearScreenTimer);
            this.stopClearScreenTimer = null;
        }
        return this.sendCommand({ command: CommandType.Clear });
    }

    async clearScreen() {
        if (!this.glasses) {
            return;
        }
        return this.sendEmptyRectangle(0, 0, 303, 225);
    }

    async sendText(x: number, y: number, direction: number, font: number, color: number, message: string) {
        return this.sendCommand({ command: CommandType.Txt, params: [x, y, direction, font, color, message] });
    }

    async changeLuminance(level: number) {
        this.levelLuminance = level;
        // appSettings.setNumber('levelLuminance', level);
        console.log('changeLuminance', level);
        return this.sendCommand({ command: CommandType.Luma, params: [level] });
    }
    shiftImage(x: number, y: number) {
        if (this.glasses && this.glasses.settings && this.glasses.settings.shift) {
            this.glasses.settings.shift.x = x;
            this.glasses.settings.shift.y = y;
            this.sendCommand({ command: CommandType.Shift, params: [x, y] });
            // this.clearFullScreen();
        }
    }

    async sendFullRectangle(x: number, y: number, xx: number, yy: number) {
        return this.sendCommand({ command: CommandType.Rectf, params: [x, y, xx, yy] });
    }
    // async sendWriteConfig(params: { configId: number; nbBitmapSaved: number; nbLayersSaved: number; nbFontsSaved: number }) {
    //     return this.sendCommand({ command: CommandType.cfgWrite, params: [params.configId, params.nbBitmapSaved, params.nbLayersSaved, params.nbFontsSaved] });
    // }

    async sendEmptyRectangle(x: number, y: number, xx: number, yy: number) {
        this.sendColor(0);
        return this.sendFullRectangle(x, y, xx, yy);
    }

    async sendColor(color: number) {
        return this.sendCommand({ command: CommandType.Color, params: [color] });
    }

    sendBitmap(name: number, x: number = 0, y: number = 0) {
        this.sendCommand({ command: CommandType.imgDisplay, params: [name, 0, 0, x, y] });
    }

    setConfig(name: string) {
        if (this.glasses.currentConfig !== name) {
            this.glasses.currentConfig = name;
            this.sendCommand({ command: CommandType.cfgSet, params: { name } });
        }
    }
    async switchSensor() {
        return this.activateSensor(!this.isSensorOn);
    }
    async switchGesture() {
        return this.activateGesture(!this.isGestureOn);
    }
    async askSettings() {
        return this.sendCommand({ command: CommandType.Settings });
    }
    async askConfigs() {
        return this.sendCommand({ command: CommandType.cfgList });
    }
    async setGlassesName(name: string) {
        return new Promise((resolve, reject) => {
            name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            this.sendCommand({
                command: CommandType.SetName,
                params: [name],
                progressCallback: (error, progress) => {
                    if (error) {
                        reject(error);
                    } else if (progress === 1) {
                        this.glasses.name = name;
                        this.savedGlassesName = name;
                        appSettings.setString('savedGlassesName', this.savedGlassesName);
                        resolve(name);
                    }
                }
            });
        });
    }

    async activateSensor(activated: boolean) {
        if (activated !== this.isSensorOn) {
            this.isSensorOn = activated;
            // appSettings.setBoolean('sensorOn', activated);
        }
        return this.sendCommand({ command: CommandType.Als, params: [this.isSensorOn ? 'on' : 'off'] });
    }
    async activateGesture(activated: boolean) {
        if (activated !== this.isGestureOn) {
            this.isGestureOn = activated;
            if (this.glasses) {
                this.glasses.gestureOn = activated;
            }
            // appSettings.setBoolean('gestureOn', activated);
        }
        return this.sendCommand({ command: CommandType.Gesture, params: [this.isGestureOn ? 'on' : 'off'] });
    }

    requestMtu() {
        if (!this.glasses) {
            return;
        }
        // glasses are supposed to support max 512 but the buffer size on the glasses is of size 256
        return this.glasses.requestMtu(this.glasses.binaryFormat ? 256 : 128);
    }
    async readFirmwareVersion() {
        if (!this.glasses) {
            return;
        }
        try {
            const r = await this.glasses.readDescriptor('180a', '2a26');
            const str = String.fromCharCode.apply(null, r);
            this.glasses.firmwareVersion = str;
            this.glasses.supportSettings = versionCompare(str, '2.9.5c') >= 0;
            DEV_LOG && console.log('readFirmwareVersion', str);
            this.notify({
                eventName: VersionEvent,
                object: this,
                data: str
            });
            return str;
        } catch (error) {
            console.error(error);
        }
    }
    async readSerialNumber() {
        if (!this.glasses) {
            return;
        }
        try {
            const r = await this.glasses.readDescriptor('180a', '2a25');
            const str = String.fromCharCode.apply(null, r);
            DEV_LOG && console.log('readSerialNumber', str);
            this.notify({
                eventName: SerialEvent,
                object: this,
                data: str
            });
            this.glasses.serialNumber = str;
            return str;
        } catch (error) {
            console.error(error);
        }
    }
    onFlowControlReading(event: ReadResult) {
        const result = new Uint8Array(event.value)[0];
        // if (DEV_LOG) {
        //     console.log(TAG, 'onFlowControlReading', result);
        // }

        if (this.glasses && result < 3) {
            this.glasses.canSendData = result === SPS_FLOW_CONTROL_ON;
        }
    }
    onBatteryReading(event: ReadResult) {
        this.glassesBattery = new Uint8Array(event.value)[0];
        // console.log('got battery', this.glassesBattery, event);
        this.notify({
            eventName: GlassesBatteryEvent,
            object: this,
            data: this.glassesBattery
        });
        return this.glassesBattery;
    }
    async readBattery() {
        if (!this.glasses) {
            return;
        }
        try {
            const data = await this.glasses.readDescriptor(BATTERY_UUID, BATTERY_DESC_UUID);
            this.onBatteryReading({ value: data.buffer } as any);
        } catch (error) {
            console.error(error);
        }
    }
    async readParamValue(chUUID: string) {
        try {
            const buffer = await this.glasses.readDescriptor(SPOTA_SERVICE_UUID, chUUID);
            return (buffer[1] << 8) | buffer[0];
        } catch (error) {
            console.error(error);
        }
    }
    sendRawCommands(commandsToSend: number[][], onProgress: (progress, current, total) => void) {
        let cancelled = false;
        const promise = new Promise(async () => {
            const datalength = commandsToSend.reduce((accumulator, currentValue) => accumulator + currentValue.length, 0);
            let dataSent = 0;

            const promisedCallback = (resolve, reject) => (err, progress, total) => {
                if (err || cancelled) {
                    return reject(err);
                }
                const p = (progress * total + dataSent) / datalength;
                onProgress(p, progress * total + dataSent, datalength);
                if (progress === 1) {
                    dataSent += total;
                    resolve();
                }
            };

            const createPromise = () =>
                new Promise((resolve, reject) => {
                    const currentCommandToSend = commandsToSend.shift();
                    // console.log('currentCommandToSend', commandsToSend.length);
                    this.sendCommand({ command: CommandType.RawCommand, params: [currentCommandToSend], progressCallback: promisedCallback(resolve, reject) });
                }).then(() => {
                    // console.log('command sent', commandsToSend.length);
                    if (!cancelled && commandsToSend.length > 0) {
                        return createPromise();
                    }
                });
            await createPromise();
            this.clearFullScreen();
        });
        promise['cancel'] = () => (cancelled = true);
        return promise as Promise<void> & { cancel() };
    }

    sendLayoutConfig(config: string, onProgress: (progress, current, total) => void) {
        let cancelled = false;
        const promise = new Promise(async () => {
            const r = await File.fromPath(config).readText();
            const commandsToSend = r.split('\n').filter((s) => s && s.trim().length > 0);
            const datalength = commandsToSend.reduce((acc, current) => acc + current.length / 2 - 1, 0);
            let dataSent = 0;

            const promisedCallback = (resolve, reject) => (err, progress, total) => {
                if (err || cancelled) {
                    return reject(err);
                }

                const p = (progress * total + dataSent) / datalength;
                onProgress(p, progress * total + dataSent, datalength);
                if (progress === 1) {
                    dataSent += total;
                    resolve();
                }
            };

            const createPromise = () =>
                new Promise((resolve, reject) => {
                    const currentCommandToSend = commandsToSend.shift();
                    const data = hexToBytes(currentCommandToSend);
                    this.sendCommand({
                        command: CommandType.RawCommand,
                        params: [data],
                        progressCallback: promisedCallback(resolve, reject)
                    });
                }).then(() => {
                    // console.log('sendLayoutConfig command sent', dataSent, datalength, commandsToSend.length);
                    if (!cancelled && commandsToSend.length > 0) {
                        return createPromise();
                    }
                });
            await createPromise();
            // console.log('sendLayoutConfig done');
            this.clearFullScreen();
        });
        promise['cancel'] = () => (cancelled = true);
        return promise as Promise<void> & { cancel() };
    }

    async startLoop() {
        // console.log('startLoop', index);
        await this.glasses.sendCommand(CommandType.Clear);
        this.sendDim(0);
        await timeout(50); // ms
    }
    async fadein() {
        for (let i = 0; i < 10; i++) {
            await timeout(20); // ms
            this.sendDim(i * 10);
        }
    }
    // async function stopLoop(index: number) {
    //     console.log('stopLoop', index);
    // }
    isFaded = false;
    async fadeout() {
        this.isFaded = true;
        for (let i = 10; i >= 0; i--) {
            // await timeout(0); // ms
            this.sendDim(i * 10);
        }
        this.clearScreen();
    }

    async demoLoop(bmpIndex: number, count = 3, pauseOnFirst = false, duration = 200) {
        for (let index = 0; index < count; index++) {
            await this.glasses.sendCommand(CommandType.imgDisplay, { params: [bmpIndex + index, 0, 0] });
            // await this.glasses.sendCommand(CommandType.Bitmap, { params: [bmpIndex + index, 0, 0] });
            await timeout(pauseOnFirst && index === 0 ? 1000 : duration);
        }
    }

    get isInLoop() {
        return this.currentLoop !== null;
    }
    currentLoop: string = null;
    isPlaying = false;
    isPlayingPaused = false;
    isPlayingStory = 0;
    isPlayingMusic = false;
    isPlayingNavigationInstruction = false;
    toPlayNext: Function = null;

    async stopPlayingInstruction(fade = true) {
        if (this.isPlaying && !this.isPlayingMusic && !this.isPlayingStory) {
            return this.stopPlayingLoop({ fade });
        }
    }

    async stopNavigationInstruction(fade = true) {
        if (this.isPlayingNavigationInstruction) {
            return this.stopPlayingLoop({ fade });
        }
    }
    async stopSession(fade = true) {
        DEV_LOG && console.log(TAG, 'stopSession', fade);
        await this.stopPlayingLoop({ fade, ignoreNext: true });
        if (fade) {
            this.playInstruction('end');
        }
    }
    async stopPlayingLoop({ fade = false, ignoreNext = false, instruction = false } = {}) {
        // if (!this.isPlaying) {
        //     return;
        // }
        DEV_LOG && console.log('stopPlayingLoop', fade, ignoreNext, instruction, this._player.isAudioPlaying());
        if (instruction && !this.isPlayingNavigationInstruction) {
            return;
        }
        this.isPlaying = false;
        this.isPlayingPaused = false;
        if (this.isPlayingStory) {
            this.isPlayingStory = 0;
            this.notify({ eventName: 'storyPlayback', data: 'stop' });
        }
        if (this.lyric) {
            this.lyric.pause();
            this.lyric = null;
        }
        if (this.currentLoop) {
            this.currentLoop = null;
            // await this.fadeout();
        }
        const onDone = async () => {
            DEV_LOG && console.log('stopPlayingLoop onDone');
            this._player.pause();
            this._player['_options']?.errorCallback();
            try {
                await this._player.dispose();
            } catch (err) {
                console.log('error disposing player', err);
            }
            this._player = new TNSPlayer();
            if (!ignoreNext && this.toPlayNext) {
                this.toPlayNext();
            }
            this.toPlayNext = null;
        };
        if (this._player.isAudioPlaying()) {
            if (fade) {
                try {
                    await new Promise((resolve) => {
                        const anim = new AdditiveTweening({
                            onRender: (obj) => {
                                this._player.volume = obj.value;
                            },
                            onFinish: resolve
                        });
                        anim.tween({ value: 1 }, { value: 0 }, 500);
                    });
                } catch (error) {
                    console.error(error);
                } finally {
                    await onDone();
                }
            } else {
                await onDone();
            }
        } else {
            await onDone();
        }
        DEV_LOG && console.log('stopPlayingLoop done', this.isPlaying);
        this.notify({ eventName: 'drawBitmap', bitmap: null });
        if (fade) {
            this.fadeout();
        } else {
            if (this.glasses) {
                await this.glasses.sendCommand(CommandType.Clear);
            }
        }
    }
    // async playLoop(index: number, count = 3) {
    //     const myLoop = index + '_' + count;
    //     if (this.currentLoop === myLoop) {
    //         return;
    //     }
    //     this.currentLoop = myLoop;
    //     await this.startLoop();
    //     this.fadein();
    //     let loopIndex = 0;
    //     while (this.currentLoop === myLoop) {
    //         await this.demoLoop(index, count, loopIndex % 2 === 0);
    //         loopIndex++;
    //     }
    //     // await this.fadeout();
    // }

    async clearFadeout() {
        if (this.isFaded) {
            this.isFaded = false;
            if (this.glasses) {
                this.glasses.sendCommand(CommandType.Clear);
                this.sendDim(100);
            }
        }
    }
    async playOfImages(images: string[], imagesFolder, options?: { frameDuration?; randomize?; iterations? }) {
        const myLoop = images.join('');
        // DEV_LOG && console.log('playOfImages', images, imagesFolder, myLoop, this.currentLoop, options, this.isFaded);
        if (images.length === 0 || this.currentLoop === myLoop) {
            return;
        }
        this.currentLoop = myLoop;
        this.clearFadeout();
        // await this.startLoop();
        // this.fadein();
        let loopIndex = 0;
        const iterations = options?.hasOwnProperty('iterations') ? options.iterations : 1;
        const imageMap = this.navigationImageMap;
        DEV_LOG && console.log('playOfImages', images, imagesFolder, myLoop, this.currentLoop, options, this.isFaded, iterations, loopIndex);
        if (this.glasses) {
            this.setConfig('nav');
        }
        while (this.currentLoop === myLoop && !this.isFaded && (!iterations || loopIndex < iterations)) {
            if (options?.randomize === true) {
                images = shuffleArray(images);
            }
            for (let index = 0; index < images.length; index++) {
                if (this.isFaded) {
                    break;
                }
                const cleaned = images[index].split('.')[0];
                // DEV_LOG && console.log('playing image', images[index], cleaned, imageMap[cleaned]);
                this.notify({ eventName: 'drawBitmap', bitmap: path.join(imagesFolder, images[index]) });
                if (this.glasses && imageMap[cleaned]) {
                    const [imageId, x, y] = imageMap[cleaned];
                    this.glasses.sendCommand(CommandType.imgDisplay, { params: [imageId, x, y] });
                    // await this.glasses.sendCommand(CommandType.Bitmap, { params: [bmpIndex + index, 0, 0] });
                }
                await timeout(options?.frameDuration || 200);
            }
            // await this.demoLoop(index, count, loopIndex % 2 === 0);
            loopIndex++;
        }
        this.notify({ eventName: 'drawBitmap', bitmap: null });
        await this.fadeout();
    }

    // async playGoLeftLoop(loop = true) {
    //     console.log('playGoLeftLoop');
    //     if (loop) {
    //         await this.playLoop(0, 3);
    //     } else {
    //         this.sendDim(100);
    //         await this.demoLoop(0, 3);
    //     }
    // }
    // async playGoRightLoop(loop = true) {
    //     console.log('playGoRightLoop');
    //     if (loop) {
    //         await this.playLoop(10, 3);
    //     } else {
    //         this.sendDim(100);
    //         await this.demoLoop(10, 3);
    //     }
    // }
    // async playGoStraightLoop(loop = true) {
    //     console.log('playGoStraightLoop');
    //     if (loop) {
    //         await this.playLoop(7, 3);
    //     } else {
    //         this.sendDim(100);
    //         await this.demoLoop(7, 3);
    //     }
    // }
    // async playGoBackLoop(loop = true) {
    //     console.log('playGoBackLoop');
    //     if (loop) {
    //         await this.playLoop(21, 6);
    //     } else {
    //         this.sendDim(100);
    //         await this.demoLoop(21, 6);
    //     }
    // }

    async sendDim(percentage: number) {
        // TODO: disabled for now
        // return this.glasses.sendCommand(CommandType.Dim, { params: [percentage] });
    }
    // async playHello() {
    //     await this._player.playFromFile({
    //         audioFile: '~/assets/audio/présentation.wav',
    //         loop: false,
    //         completeCallback: () => {
    //             this.stopPlayingLoop();
    //         }
    //     });
    //     await this.glasses.sendCommand(CommandType.Clear);
    //     this.sendDim(100);
    //     await this.glasses.sendCommand(CommandType.Bitmap, { params: [32, 0, 0] });
    //     await timeout(3000);
    //     await this.glasses.sendCommand(CommandType.Bitmap, { params: [33, 0, 0] });
    //     await timeout(3000);
    //     await this.demoLoop(27, 5, false, 400);
    //     await this.glasses.sendCommand(CommandType.Clear);
    // }

    // async playDemo() {
    //     await this._player.playFromFile({
    //         audioFile: '~/assets/audio/présentation.wav', // ~ = app directory
    //         loop: false,
    //         completeCallback: () => {
    //             this.stopPlayingLoop();
    //         }
    //     });
    //     this.playLoop(13, 8);
    // }

    parseLottieFile(data: any) {
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
            if (last && (timeline[timeline.length - 1].time >= newStart || newStart - timeline[timeline.length - 1].time <= 18)) {
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
                assets[l.refId].forEach((d) => addData(d, l.ip, l.op));
            } else {
                addData(l);
            }
        });
        return timeline;
    }

    _imagesMap: { [k: string]: { [k: string]: [number, number, number, number, number] } } = {};

    storyImageMap(cfgId: string) {
        if (!this._imagesMap[cfgId]) {
            const filePath = path.join(getGlassesImagesFolder(), 'stories', cfgId, 'image_map.json');
            this._imagesMap[cfgId] = JSON.parse(File.fromPath(filePath).readTextSync());
        }
        return this._imagesMap[cfgId];
    }
    _navigationMapImagesMap: { [k: string]: [number, number, number, number, number] };
    get navigationImageMap() {
        if (!this._navigationMapImagesMap) {
            const filePath = path.join(getGlassesImagesFolder(), 'navigation/image_map.json');
            this._navigationMapImagesMap = JSON.parse(File.fromPath(filePath).readTextSync());
        }
        return this._navigationMapImagesMap;
    }

    async playAudio(audio: string, loop = false) {
        return new Promise<void>(async (resolve, reject) => {
            await this._player.playFromFile({
                audioFile: audio, // ~ = app directory
                loop,
                completeCallback: () => {
                    resolve();
                },
                errorCallback: () => {
                    reject();
                }
            });
        });
    }

    async playAudios(audios: string[]) {
        for (let index = 0; index < audios.length; index++) {
            const audio = audios[index];
            await this.playAudio(audio);
        }
    }
    async playNavigationInstruction(instruction: string, options?: { audioFolder?: string; frameDuration?; randomize?; iterations?; delay?; queue?; force?; noAudio? }) {
        DEV_LOG && console.log('playNavigationInstruction', instruction, this.isPlaying, options);
        if (instruction === 'exit') {
            instruction = 'uturn';
            options = options || {};
            options.audioFolder = options.audioFolder || path.join(getGlassesImagesFolder(), 'navigation', 'exit');
        }
        return this.playInstruction(instruction, { iterations: 0, frameDuration: 300, instruction: true, queue: false, randomAudio: true, ...options });
    }
    async playInstruction(instruction: string, options?: { audioFolder?: string; frameDuration?; randomize?; iterations?; delay?; queue?; force?; noAudio?; randomAudio?: boolean; instruction? }) {
        DEV_LOG && console.log('playInstruction', instruction, this.isPlaying, options);
        if (this.isPlaying) {
            if (options?.force === true) {
                await this.stopPlayingLoop({ fade: false, ignoreNext: true });
            } else if (options?.queue !== false) {
                return new Promise<void>((resolve) => {
                    this.toPlayNext = async () => {
                        await this.playInstruction(instruction, options);
                        resolve();
                    };
                });
            }
            if (options?.noAudio === true && this.isPlayingMusic) {
                // we can still play the instruction
            } else {
                return;
            }
        }
        if (instruction) {
            this.isPlayingNavigationInstruction = true;
        }
        this.isPlaying = true;

        const instFolder = path.join(getGlassesImagesFolder(), `navigation/${instruction}`);
        DEV_LOG && console.log('playInstruction instFolder', instruction, instFolder, Folder.exists(instFolder));
        if (!Folder.exists(instFolder)) {
            return;
        }
        const files = await Folder.fromPath(instFolder).getEntities();
        const audioFiles = options?.audioFolder ? await Folder.fromPath(options?.audioFolder).getEntities() : files;
        const images = files
            .filter((f) => f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.bmp'))
            .map((f) => f.name)
            .sort();
        const audios = !!options?.noAudio
            ? []
            : audioFiles
                  .filter((f) => f.name.endsWith('.mp3'))
                  .map((f) => f.path)
                  .sort();
        DEV_LOG && console.log('images', images);
        DEV_LOG && console.log('audios', audios);
        if (audios && audios.length) {
            await new Promise<void>((resolve, reject) => {
                if (options?.delay) {
                    setTimeout(() => {
                        this.playOfImages(images, instFolder, options);
                    }, options?.delay);
                } else {
                    this.playOfImages(images, instFolder, options);
                }
                this.playAudios(options?.randomAudio ? [getRandomFromArray(audios)] : audios)
                    .then(() => {
                        DEV_LOG && console.log('instruction played done');
                        resolve();
                    })
                    .catch(reject);
            });
        } else {
            await this.playOfImages(images, instFolder, options);
        }
        await this.stopPlayingLoop({ instruction: options?.instruction });
        if (instruction) {
            this.isPlayingNavigationInstruction = false;
        }
    }
    lyric: Lyric = null;

    async playRideauAndStory(storyIndex = 1) {
        DEV_LOG && console.log('playRideauAndStory', storyIndex, this.isPlayingStory, this.isPlaying);
        if (this.isPlayingStory === storyIndex) {
            return;
        }
        // finish what we are playing first
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playRideauAndStory(storyIndex);
                    resolve();
                };
            });
        }
        // console.log('playRideauAndStory', this.isPlaying);
        // set it now to make sure we dont play the same story twice
        this.isPlayingStory = storyIndex;
        await this.playInstruction('rideau', { iterations: 1 });
        this.playStory(storyIndex);
    }

    currentLyricsTime = 0;
    async pauseStory() {
        if (this.isPlayingStory) {
            this._player.pause();
            this.currentLyricsTime = this.lyric.pause();
            this.isPlayingPaused = true;
            this.notify({ eventName: 'storyPlayback', data: 'pause' });
        }
    }
    async resumeStory() {
        if (this.isPlayingStory && this.isPlayingPaused) {
            this._player.resume();
            this.lyric.play(this.currentLyricsTime);
            this.isPlayingPaused = false;
            this.notify({ eventName: 'storyPlayback', data: 'play' });
        }
    }
    async playStory(index = 1) {
        DEV_LOG && console.log('playStory', index, this.isPlaying);
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playStory(index);
                    resolve();
                };
            });
        }
        try {
            this.isPlaying = true;
            this.isPlayingStory = index;
            const cfgId = index + '';
            const storyFolder = path.join(getGlassesImagesFolder(), 'stories', cfgId);
            const data = await File.fromPath(path.join(storyFolder, 'composition.json')).readText();
            const imagesMap = this.storyImageMap(cfgId);
            const result = this.parseLottieFile(JSON.parse(data));
            if (this.glasses) {
                this.setConfig(cfgId);
                this.sendDim(100);
            }
            if (this.lyric) {
                this.lyric.pause();
            }
            this.lyric = new Lyric({
                lines: [{ time: 0, text: '' }].concat(result),
                onPlay: async (line, text) => {
                    if (text && text.length > 0) {
                        const cleaned = text.split('.')[0];
                        if (imagesMap[cleaned]) {
                            const [imageId, x, y] = imagesMap[cleaned];
                            // console.log('playing image', imageId);
                            this.clearFadeout();

                            // console.log('playing image', text, cleaned, imageId);
                            if (this.glasses) {
                                this.glasses.sendCommand(CommandType.imgDisplay, { params: [imageId, x, y] });
                            }
                            this.notify({ eventName: 'drawBitmap', bitmap: path.join(storyFolder, 'images', cleaned + '.png') });
                        } else {
                            console.error('image missing', text, cleaned);
                        }
                    } else {
                        this.notify({ eventName: 'drawBitmap', bitmap: null });
                        this.clearScreen();
                    }
                }
            });
            this.clearFadeout();
            this.lyric.play();
            console.log('notify storyPlayback');
            this.notify({ eventName: 'storyPlayback', data: 'play' });
            await this.playAudio(path.join(storyFolder, 'audio.mp3'));
            DEV_LOG && console.log('playStory done ', index, this.isPlaying);
            // mark story as played

            this.geoHandler.playedStory(index + '');
            this.playInstruction('story_finished');
        } finally {
            this.currentLyricsTime = 0;
            console.log('finished playing story');
            this.stopPlayingLoop();
        }
    }

    async playMusic(index) {
        // this.isPlaying = true;
        this.isPlayingMusic = true;
        // story will play right after so store the playing index
        // so we know what s about to play
        // this.isPlayingStory = index;
        try {
            // const storyFolder = path.join(getGlassesImagesFolder(), `stories/${index}`);
            // DEV_LOG && console.log('playMusic', storyFolder);
            await this.playInstruction('music', { randomAudio: true });
            // await this.playAudio(path.join(storyFolder, 'musique.mp3'));
        } finally {
            this.isPlayingMusic = false;
            this.stopPlayingLoop();
        }
    }
}
