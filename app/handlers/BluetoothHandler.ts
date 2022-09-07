import { TNSPlayer } from '@akylas/nativescript-audio';
import { Bluetooth, StartScanningOptions as IStartScanningOptions, Peripheral, ReadResult, StartNotifyingOptions } from '@nativescript-community/ble';
import { isSimulator } from '@nativescript-community/extendedinfo';
import { request } from '@nativescript-community/perms';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ApplicationSettings, File } from '@nativescript/core';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { Folder, path } from '@nativescript/core/file-system';
import { AdditiveTweening } from 'additween';
import dayjs from 'dayjs';
import fileSize from 'filesize';
import { getUint32 } from '~/handlers/bluetooth/SuotaCharacteristic';
import { GeoHandler, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { CommandType, ConfigListData, FULLSCREEN, FreeSpaceData, InputCommandType, Message } from '~/handlers/Message';
import { DURATION_FORMAT, formatDuration } from '~/helpers/formatter';
import { $t, $tc } from '~/helpers/locale';
import * as ProgressNotification from '~/services/android/ProgressNotifications';
import { GlassesError, MessageError } from '~/services/CrashReportService';
import { hashCode, permResultCheck, versionCompare } from '~/utils';
import { alert, confirm } from '~/utils/dialogs';
import { getGlassesImagesFolder } from '~/utils/utils';
import { Characteristic } from './bluetooth/Characteristic';
import { GlassesDevice } from './bluetooth/GlassesDevice';
import Lyric from './Lyric';

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
export const FADING_SUPPORTED = false;

export const FinishSendingEvent = 'finishSending';
export const StatusChangedEvent = 'status';
export const GlassesConnectedEvent = 'glassesConnected';
export const GlassesReadyEvent = 'glassesReady';
export const BLEConnectedEvent = 'connected';
export const GlassesDisconnectedEvent = 'glassesDisconnected';
export const GlassesReconnectingEvent = 'GlassesReconnecting';
export const GlassesReconnectingFailedEvent = 'GlassesReconnectingFailed';
export const BLEDisconnectedEvent = 'disconnected';
export const GlassesBatteryEvent = 'glassesBattery';
export const GlassesScreenChangeEvent = 'glassesScreenChange';
export const GlassesMemoryChangeEvent = 'glassesMemory';
export const GlassesScreenStateChangeEvent = 'glassesScreenStateChange';
export const VersionEvent = 'version';
export const HardwareVersionEvent = 'hardwareVersion';
export const SerialEvent = 'serial';
export const GlassesSettingsEvent = 'settings';
export const GlassesErrorEvent = 'error';
export const DevLogMessageEvent = 'devlogmessage';
export const AvailableConfigsEvent = 'availableConfigs';

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
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return new Uint8Array(bytes);
}

export type CancelPromise<T = void> = Promise<T> & { cancel() };

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
    currentGlassesMemory: FreeSpaceData;

    geoHandler: GeoHandler;

    devLog: Message<any>[];
    canDrawOnGlasses: boolean = true;
    currentConfigs: ConfigListData = null;

    needsPowerOn = true;
    isScreenOn = true;
    isSensorOn = true;
    isGestureOn = true;
    levelLuminance = 10;
    mPlayer = new TNSPlayer();

    currentLoop: string = null;
    isPlaying = false;
    isPlayingPaused = false;
    isPlayingStory = 0;
    isPlayingMusic = false;
    isPlayingPastille = 0;
    isPlayingNavigationInstruction = null;
    toPlayNext: Function = null;

    get playerCurrentTime() {
        return this.mPlayer?.currentTime || 0;
    }
    get isInLoop() {
        return this.currentLoop !== null;
    }
    get playerState() {
        if (this.isPlayingStory || this.isPlayingPastille) {
            return this.isPlayingPaused ? 'pause' : 'play';
        }
        return 'stopped';
    }
    get playingInfo() {
        if (this.isPlayingStory || this.isPlayingPastille) {
            return {
                duration: this.mPlayer?.duration || 0,
                name: this.isPlayingStory ? $tc('story', this.isPlayingStory) : `Pastille: ${this.isPlayingPastille}`,
                cover: this.isPlayingStory ? path.join(getGlassesImagesFolder(), 'stories', this.isPlayingStory + '', 'cover.png') : path.join(getGlassesImagesFolder(), 'pastilles', 'cover.png')
            };
        } else if (this.isPlaying) {
            return {
                duration: this.mPlayer?.duration || 0,
                canPause: false,
                name: this.isPlayingNavigationInstruction
            };
        }
        return { duration: 0, name: null };
    }

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
    async start() {
        if (!PRODUCTION) {
            await request('storage');
        }
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
            DEV_LOG && console.log(TAG, 'connectToSaved', 'start', this.savedGlassesUUID);
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

    async enable() {
        if (isSimulator()) {
            // return Promise.resolve();
            throw new MessageError({ message: 'running in simulator' });
        }
        const enabled = await bluetooth.enable();
        if (!enabled) {
            if (__IOS__) {
                alert({
                    title: $tc('bluetooth_not_enabled'),
                    okButtonText: $t('ok')
                });
            } else {
                const result = await confirm({
                    message: $tc('bluetooth_not_enabled'),
                    okButtonText: $t('cancel'), // inversed buttons
                    cancelButtonText: $t('settings')
                });
                if (!result) {
                    await bluetooth.openBluetoothSettings();
                }
            }
        }
        return enabled;
    }

    async authorizeBluetooth() {
        if (__ANDROID__) {
            const r = await request(['bluetoothScan', 'bluetoothConnect']);
            if (!permResultCheck(r)) {
                throw new Error('gps_denied');
            }
            return r;
        }
    }
    async enableForScan() {
        let enabled = await this.isEnabled();
        await this.authorizeBluetooth();
        if (!enabled) {
            const r = await confirm({
                message: $tc('bluetooth_not_enabled'),
                okButtonText: $t('cancel'), // inversed buttons
                cancelButtonText: __ANDROID__ ? $t('enable') : undefined
            });
            if (r) {
                throw new Error($tc('bluetooth_not_enabled'));
            }
            if (__ANDROID__ && !r) {
                try {
                    await this.enable();
                } catch (err) {
                    console.error(err);
                }
                enabled = await this.isEnabled();
            }
        }
        await this.geoHandler.checkIfEnabled();
        if (!this.geoHandler.gpsEnabled || !enabled) {
            return Promise.reject(undefined);
        }
        await this.geoHandler.checkEnabledAndAuthorized();
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
                this.canDrawOnGlasses = true;
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

                // TODO test not setting mtu. Right now we cant because without it we dont know the mtu we can use
                await this.requestMtu();

                if (this.glasses.hasFlowControl) {
                    await Characteristic.startNotifying(glasses.UUID, SERVER_SERVICE_UUID, FLOW_SERVER_UUID, this.onFlowControlReading.bind(this));
                }
                await Characteristic.startNotifying(glasses.UUID, BATTERY_UUID, BATTERY_DESC_UUID, this.onBatteryReading.bind(this));
                await this.readGlassesVersions();
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

                // This improve latency in sending messages
                this.setBLEConnectParam({
                    intervalMinMs: 7.5,
                    intervalMaxMs: 7.5,
                    slaveLatency: 0,
                    supTimeoutMs: 5000
                });
                this.sendDim(100);
                this.setConfig('nav');
                this.clearScreen();
                this.askConfigs();
                this.notify({
                    eventName: GlassesReadyEvent,
                    object: this,
                    data: glasses
                } as BLEEventData);
            }
            this.removeConnectingDeviceUUID(data.UUID);
            this.notify({
                eventName: BLEConnectedEvent,
                object: this,
                data
            } as BLEEventData);
        } catch (e) {
            console.error(e, e.stack);
            this.disconnect(data.UUID, false);

            // make sure the error is shown in the UI
            // setTimeout(() => {
            //     throw e;
            // }, 0);
        }
    }

    onDeviceDisconnected(e: BluetoothDeviceEvent) {
        const data = e.data;
        DEV_LOG && console.log(TAG, 'onDeviceDisconnected', !!this.glasses, this.glasses && data.UUID === this.glasses.UUID);
        this.removeConnectingDeviceUUID(data.UUID);

        if (this.glasses && data.UUID === this.glasses.UUID) {
            this.geoHandler.setReadableStories(null);
            this.notify({ eventName: AvailableConfigsEvent, data: null });
            this.glasses.onDisconnected();
            this.glasses = null;
            this.currentGlassesMemory = null;
            this.currentConfigs = null;
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
                autoDiscoverAll: false,
                priority: 1
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
        switch (message.commandType) {
            case CommandType.cfgList:
                const list = (message as Message<CommandType.cfgList>).data;
                this.currentConfigs = list.sort((a, b) => a.name.localeCompare(b.name));
                this.notify({ eventName: AvailableConfigsEvent, data: this.currentConfigs });
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
            case CommandType.Error:
                if (message.data.cmdId === CommandType.cfgSet) {
                }
        DEV_LOG && console.log('onGlassesMessage error', message.commandType, message.data);
        this.notify({
                    eventName: GlassesErrorEvent,
                    object: this,
                    data: new GlassesError(`0x${message.data.cmdId.toString(16)} error ${message.data.error}`)
                });
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
    public sendCommands(commands: { commandType: CommandType; params?: InputCommandType<any> }[], options: { progressCallback?: ProgressCallback } = {}) {
        if (!this.glasses) {
            return;
        }
        return this.glasses.sendCommands(commands, options);
    }

    createPlayer() {
        this.mPlayer = new TNSPlayer();
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
        this.sendCommand({ command: CommandType.imgDisplay, params: [name, x, y] });
    }

    setConfig(name: string) {
        if (this.glasses.currentConfig !== name) {
            this.glasses.currentConfig = name;
            DEV_LOG && console.log('setConfig', name);
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
    async setBLEConnectParam(params: InputCommandType<CommandType.SetBLEConnectParam>) {
        return this.sendCommand({ command: CommandType.SetBLEConnectParam, params });
    }
    async askConfigs() {
        DEV_LOG && console.log('askConfigs');
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

    async readGlassesVersions() {
        if (!this.glasses) {
            return;
        }
        try {
            let value = await this.glasses.readDescriptor('180a', '2a24');
            const model = String.fromCharCode.apply(null, value);
            value = await this.glasses.readDescriptor('180a', '2a26');
            const firmwareVersion = String.fromCharCode.apply(null, value);
            this.glasses.supportSettings = versionCompare(firmwareVersion, '2.9.5c') >= 0;

            value = await this.glasses.readDescriptor('180a', '2a27');
            const hardwareVersion = String.fromCharCode.apply(null, value);

            value = await this.glasses.readDescriptor('180a', '2a28');
            const softwareVersion = String.fromCharCode.apply(null, value);
            const versions = (this.glasses.versions = {
                model,
                firmware: firmwareVersion,
                hardware: hardwareVersion,
                software: softwareVersion
            });

            this.notify({
                eventName: VersionEvent,
                object: this,
                data: versions
            });
            return versions;
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
    sendRawCommands(commandsToSend: (number[] | Uint8Array)[], onProgress: (progress, current, total) => void) {
        let cancelled = false;
        const promise = new Promise<void>((resolveUp, rejectUp) => {
            const datalength = commandsToSend.reduce((accumulator, currentValue) => accumulator + currentValue.length, 0);
            let dataSent = 0;
            this.glasses.rxChar.sendWithResponse = false;
            this.glasses.rxChar.writeTimeout = ApplicationSettings.getNumber('sendStoryWriteTimeout', 1);
            const promisedCallback = (resolve, reject) => (err, progress, total) => {
                if (err || cancelled) {
                    return reject(err || 'cancelled');
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
                    if (cancelled) {
                        rejectUp(Error('cancelled'));
                    } else if (commandsToSend.length > 0) {
                        return createPromise();
                    }
                });
            createPromise()
                .then(() => {
                    this.glasses.rxChar.sendWithResponse = true;
                    this.glasses.rxChar.writeTimeout = 0;
                    this.clearFullScreen();
                    resolveUp();
                })
                .catch((err) => {
                    this.glasses.rxChar.writeTimeout = 0;
                    this.glasses.rxChar.sendWithResponse = true;
                    rejectUp(err);
                });
        });
        promise['cancel'] = () => (cancelled = true);
        return promise as CancelPromise;
    }

    sendLayoutConfig(config: string, onProgress: (progress, current, total) => void): CancelPromise {
        const r = File.fromPath(config).readTextSync();
        const commandsToSend = r
            .split('\n')
            .filter((s) => s && s.trim().length > 0)
            .map(s=> (s.startsWith('0x')?s.slice(2) : s))
            .map(hexToBytes);
        return this.sendRawCommands(commandsToSend, onProgress);
    }

    async startLoop() {
        // console.log('startLoop', index);
        await this.glasses.sendCommand(CommandType.Clear);
        if (FADING_SUPPORTED) {
            this.sendDim(0);
            await timeout(50); // ms
        }
    }
    async fadein() {
        if (FADING_SUPPORTED) {
            for (let i = 0; i < 10; i++) {
                await timeout(20); // ms
                this.sendDim(i * 10);
            }
        }
    }
    // async function stopLoop(index: number) {
    //     console.log('stopLoop', index);
    // }
    isFaded = false;
    async fadeout() {
        if (FADING_SUPPORTED) {
            this.isFaded = true;
            for (let i = 10; i >= 0; i--) {
                this.sendDim(i * 10);
            }
        }
        this.clearScreen();
    }

    async demoLoop(bmpIndex: number, count = 3, pauseOnFirst = false, duration = 200) {
        for (let index = 0; index < count; index++) {
            await this.glasses.sendCommand(CommandType.imgDisplay, { params: [bmpIndex + index, 0, 0] });
            await timeout(pauseOnFirst && index === 0 ? 1000 : duration);
        }
    }

    async stopPlayingInstruction(fade = true) {
        if (this.isPlaying && !this.isPlayingMusic && !this.isPlayingStory && !this.isPlayingPastille) {
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
        // DEV_LOG && console.log('stopPlayingLoop', fade, ignoreNext, instruction, this.mPlayer.isAudioPlaying());
        if (instruction && !this.isPlayingNavigationInstruction) {
            return;
        }
        DEV_LOG && console.log('stopPlayingLoop instFolder', fade, ignoreNext, instruction, this.mPlayer.isAudioPlaying());
        this.isPlaying = false;
        this.isPlayingPaused = false;
        this.isPlayingMusic = false;
        if (this.isPlayingStory || this.isPlayingPastille) {
            this.isPlayingPastille = 0;
            this.isPlayingStory = 0;
            this.notify({ eventName: 'playback', data: 'stopped' });
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
            this.mPlayer.pause();
            this.mPlayer['_options']?.errorCallback();
            try {
                await this.mPlayer.dispose();
            } catch (err) {
                console.error('error disposing player', err);
            }
            this.mPlayer = new TNSPlayer();
            if (!ignoreNext && this.toPlayNext) {
                this.toPlayNext();
            }
            this.toPlayNext = null;
        };
        if (this.mPlayer.isAudioPlaying()) {
            if (fade) {
                try {
                    await new Promise((resolve) => {
                        const anim = new AdditiveTweening({
                            onRender: (obj) => {
                                this.mPlayer.volume = obj.value;
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
        if (FADING_SUPPORTED && this.isFaded) {
            this.isFaded = false;
            if (this.glasses) {
                this.glasses.sendCommand(CommandType.Clear);
                this.sendDim(100);
            }
        }
    }
    async playOfImages(images: string[], imagesFolder, options?: { frameDuration?; randomize?; iterations? }) {
        if (!this.canDrawOnGlasses) {
            return;
        }
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
        DEV_LOG && console.log('playOfImages', JSON.stringify({ images, imagesFolder, myLoop, options, isFaded: this.isFaded, iterations, loopIndex }));
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
                    const data = imageMap[cleaned];
                    this.glasses.sendCommand(CommandType.imgDisplay, { params: data.slice(0, 3) });
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

    async sendDim(percentage: number) {
        if (FADING_SUPPORTED) {
            return this.glasses.sendCommand(CommandType.Dim, { params: [percentage] });
        }
    }
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

    _setsData: { [k: string]: { imagesMap:{[k: string]: [number, number, number, number, number, string]}, info:{ totalImageSize,
        compress,
        crop} }} = {};

    storyImageMap(cfgId: string) {
        return this.setData(cfgId).imagesMap;
    }
    get setUsesCrop() {
        return id=>{
            return this.setData(id).info.crop;
        }
    }
    get setData() {
        return id=>{
            if (!this._setsData[id]) {
                let imagesFolder = getGlassesImagesFolder();
                if (id !== 'navigation') {
                    imagesFolder = path.join(imagesFolder, 'stories');
                }
                console.log('setData', id, imagesFolder);
                const imagesMap = JSON.parse(File.fromPath(path.join(imagesFolder, id, 'image_map.json')).readTextSync());
                const info = JSON.parse(File.fromPath(path.join(imagesFolder, id,  'info.json')).readTextSync());
                this._setsData[id] = {imagesMap, info}
            }
            return this._setsData[id];
        }
    }
    get navigationImageMap() {
        return this.setData('navigation').imagesMap;
    }

    async playAudio({ fileName, loop = false, notify = false }: { fileName: string; loop?: boolean; notify?: boolean }) {
        if (!File.exists(fileName)) {
            throw new Error($tc('file_not_found', fileName));
        }
        const file = File.fromPath(fileName);
        DEV_LOG && console.log('playAudio', fileName, loop, file.size);
        return new Promise<void>(async (resolve, reject) => {
            try {
                let resolved = false;
                await this.mPlayer.playFromFile({
                    autoPlay: true,
                    audioFile: fileName,
                    loop,
                    completeCallback: () => {
                        if (!loop && !resolved) {
                            this.notify({ eventName: 'playback', data: 'stopped' });
                            resolved = true;
                            resolve();
                        }
                    },
                    errorCallback: () => {
                        if (!resolved) {
                            this.notify({ eventName: 'playback', data: 'stopped' });
                            resolved = true;
                            reject();
                        }
                    }
                });
                // if (notify === true) {
                this.notify({ eventName: 'playbackStart', data: this.playingInfo });
                // }
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    }

    async playAudios(audios: string[], loop = false) {
        for (let index = 0; index < audios.length; index++) {
            await this.playAudio({ fileName: audios[index], loop });
        }
    }
    async playNavigationInstruction(instruction: string, options?: { audioFolder?: string; frameDuration?; randomize?; iterations?; delay?; queue?; force?; noAudio? }) {
        // DEV_LOG && console.log('playNavigationInstruction', instruction, this.isPlaying, options);
        if (instruction === 'exit') {
            instruction = 'uturn';
            options = options || {};
            options.audioFolder = options.audioFolder || path.join(getGlassesImagesFolder(), 'navigation', 'exit');
        }
        return this.playInstruction(instruction, { iterations: 0, frameDuration: 300, instruction: true, queue: false, randomAudio: true, ...options });
    }
    async playInstruction(
        instruction: string,
        options?: { audioFolder?: string; frameDuration?; randomize?; iterations?; delay?; queue?; force?; noAudio?; randomAudio?: boolean; loop?: boolean; instruction? }
    ) {
        // DEV_LOG && console.log('playInstruction', instruction, this.isPlaying, JSON.stringify(options));
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

        const instFolder = path.join(getGlassesImagesFolder(), `navigation/${instruction}`);
        DEV_LOG && console.log('playInstruction', instruction, instFolder, Folder.exists(instFolder));
        if (!Folder.exists(instFolder)) {
            return;
        }
        if (instruction) {
            this.isPlayingNavigationInstruction = instruction;
        }
        this.isPlaying = true;
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
        // DEV_LOG && console.log('images', images);
        // DEV_LOG && console.log('audios', audios);
        if (audios?.length) {
            await new Promise<void>((resolve, reject) => {
                if (options?.delay) {
                    setTimeout(() => {
                        this.playOfImages(images, instFolder, options);
                    }, options?.delay);
                } else {
                    this.playOfImages(images, instFolder, options);
                }
                this.playAudios(options?.randomAudio ? [getRandomFromArray(audios)] : audios, options?.loop)
                    .then(() => {
                        // DEV_LOG && console.log('instruction played done');
                        resolve();
                    })
                    .catch(reject);
            });
        } else {
            await this.playOfImages(images, instFolder, options);
        }
        await this.stopPlayingLoop({ instruction: options?.instruction });
        if (instruction) {
            this.isPlayingNavigationInstruction = null;
        }
    }
    lyric: Lyric = null;

    async playRideauAndStory(storyIndex = 1) {
        if (!this.canDrawOnGlasses) {
            return;
        }
        DEV_LOG && console.log('playRideauAndStory', storyIndex, this.isPlayingStory, this.isPlaying, this.isPlayingPastille);
        if (this.isPlayingStory === storyIndex) {
            return;
        }
        if (!this.isPlayingPastille && !this.isPlayingStory) {
            await this.stopPlayingLoop({ fade: true });
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
        return this.playStory(storyIndex);
    }

    currentLyricsTime = 0;
    async pauseStory() {
        if (this.isPlayingStory || this.isPlayingPastille) {
            this.mPlayer.pause();
            if (this.lyric) {
                this.currentLyricsTime = this.lyric.pause();
            }
            this.isPlayingPaused = true;
            this.notify({ eventName: 'playback', data: 'pause' });
        }
    }
    async resumeStory() {
        if (this.isPlayingStory && this.isPlayingPaused) {
            this.mPlayer.resume();
            if (this.lyric) {
                this.lyric.play(this.currentLyricsTime);
            }
            this.isPlayingPaused = false;
            this.notify({ eventName: 'playback', data: 'play' });
        }
    }
    async playStory(index = 1) {
        if (!this.canDrawOnGlasses) {
            return;
        }
        DEV_LOG && console.log('playStory', index, this.isPlaying);
        if (this.isPlaying || !this.canDrawOnGlasses) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playStory(index);
                    resolve();
                };
            });
        }
        try {
            const cfgId = index + '';
            const storyFolder = path.join(getGlassesImagesFolder(), 'stories', cfgId);
            console.log('storyFolder', storyFolder, Folder.exists(storyFolder));
            if (!Folder.exists(storyFolder)) {
                return;
            }
            this.isPlaying = true;
            this.isPlayingStory = index;
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
            const navImages = this.navigationImageMap;
            let lastImageWasNav = false;
            const navUseCrop = this.setUsesCrop('navigation');
            const storyUseCrop = this.setUsesCrop(cfgId);
            this.lyric = new Lyric({
                lines: [{ time: 0, text: '' }].concat(result),
                onPlay: async (line, text) => {
                    if (text && text.length > 0) {
                        const commands: { commandType: CommandType; params?: InputCommandType<any> }[] = [];

                        const cleaned = text.split('.')[0];
                        console.log('onPlay', cleaned, !!navImages[cleaned], navUseCrop, !!imagesMap[cleaned], storyUseCrop)
                        if (navImages[cleaned]) {
                            
                            if (!lastImageWasNav) {
                                commands.push({
                                    commandType: CommandType.cfgSet,
                                    params: { name: 'nav' }
                                });
                            }
                            if (navUseCrop) {
                                commands.push(
                                    {
                                        commandType: CommandType.HoldFlushw,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Color,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Rectf,
                                        params: FULLSCREEN
                                    }
                                );
                            }
                            lastImageWasNav = true;
                            const data = navImages[cleaned];
                            commands.push({
                                commandType: CommandType.imgDisplay,
                                params: data.slice(0, 3)
                            });
                            if (navUseCrop) {
                                commands.push({
                                    commandType: CommandType.HoldFlushw,
                                    params: [1]
                                });
                            }
                            this.sendCommands(commands);
                            const instFolder = path.join(getGlassesImagesFolder(), `navigation/${data[5]}`);
                            this.notify({ eventName: 'drawBitmap', bitmap: path.join(instFolder, cleaned + '.png') });
                        } else if (imagesMap[cleaned]) {
                            if (lastImageWasNav) {
                                commands.push({
                                    commandType: CommandType.cfgSet,
                                    params: { name: cfgId }
                                });
                            }
                            lastImageWasNav = false;
                            // const [imageId, x, y] = imagesMap[cleaned];
                            // this.clearFadeout();
                            // this.sendBitmap(imageId, x, y);
                            if (storyUseCrop) {
                                commands.push(
                                    {
                                        commandType: CommandType.HoldFlushw,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Color,
                                        params: [0]
                                    },
                                    {
                                        commandType: CommandType.Rectf,
                                        params: FULLSCREEN
                                    }
                                );
                            }
                            commands.push({
                                commandType: CommandType.imgDisplay,
                                params: imagesMap[cleaned]
                            });
                            if (storyUseCrop) {
                                commands.push({
                                    commandType: CommandType.HoldFlushw,
                                    params: [1]
                                });
                            }
                            this.sendCommands(commands);
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
            // this.notify({ eventName: 'playback', data: 'play' });
            await this.playAudio({ fileName: path.join(storyFolder, 'audio.mp3'), notify: true });
            DEV_LOG && console.log('playStory done ', index, this.isPlaying);
            // mark story as played

            this.geoHandler.playedStory(index + '');
            this.notify({ eventName: 'playback', data: 'stopped' });
            this.playInstruction('story_finished');
        } catch (err) {
            throw err;
        } finally {
            this.currentLyricsTime = 0;
            DEV_LOG && console.log('finished playing story');
            this.stopPlayingLoop();
        }
    }
    async playPastille(index) {
        DEV_LOG && console.log('playPastille', index, this.isPlaying);
        if (this.isPlaying) {
            return new Promise<void>((resolve) => {
                this.toPlayNext = async () => {
                    await this.playPastille(index);
                    resolve();
                };
            });
        }
        try {
            this.isPlaying = true;
            this.isPlayingPastille = index;
            const storyFolder = path.join(getGlassesImagesFolder(), 'pastilles');
            this.clearFadeout();
            await this.playAudio({ fileName: path.join(storyFolder, `pastille_${index}.mp3`), notify: true });
            DEV_LOG && console.log('playPastille done ', index, this.isPlaying);
            this.geoHandler.playedPastille(index + '');
        } catch (error) {
            console.error('playPastille error', error);
            this.geoHandler.playedPastille(index + '');
        } finally {
            console.log('finished playing playPastille');
            this.stopPlayingLoop();
        }
    }

    async playMusic(index, loop = false) {
        this.isPlayingMusic = true;
        try {
            await this.playInstruction('music', { randomAudio: true, loop });
        } finally {
            this.isPlayingMusic = false;
            this.stopPlayingLoop();
        }
    }

    async getMemory(force = false) {
        if (!this.currentGlassesMemory || force) {
            const result = await this.sendCommand({ command: CommandType.cfgFreeSpace, timestamp: Date.now() });
            DEV_LOG && console.log('getMemory result', result?.data);
            this.currentGlassesMemory = result?.data || ({} as FreeSpaceData);
            this.notify({ eventName: GlassesMemoryChangeEvent, data: this.currentGlassesMemory });
        }
        return this.currentGlassesMemory;
    }
    sendConfigPromise: CancelPromise = null;
    async sendConfigToGlasses(config: string, memory: FreeSpaceData, onStart?: (promise: CancelPromise) => void, onProgress?: (progress, current, total) => void) {
        let progressNotificationId;
        try {
            progressNotificationId = 52347 + hashCode(config);
            if (this.sendConfigPromise) {
                throw new Error('sending_config');
            }
            this.canDrawOnGlasses = false;
            const startTime = Date.now();
            const configId = config.slice(-1);
            await new Promise<void>(async (resolve, reject) => {
                try {
                    let size;
                    try {
                        size = JSON.parse(File.fromPath(path.join(config, 'info.json')).readTextSync()).totalImageSize;
                    } catch (error) {
                        console.error(error);
                        size = File.fromPath(path.join(config, 'images.txt')).size / 2;
                    }
                    DEV_LOG && console.log('sendConfigToGlasses', configId, size, memory.freeSpace);
                    if (size >= memory.freeSpace) {
                        throw new MessageError({ message: $tc('not_enough_memory', size, memory.freeSpace) });
                    }
                    const progressNotification = ProgressNotification.show({
                        id: progressNotificationId, //required
                        title: $tc('uploading_story_to_glasses', configId, fileSize(size)),
                        message: '',
                        ongoing: true,
                        indeterminate: false,
                        progressValue: 0,
                        actions: [
                            {
                                id: 'cancel',
                                text: $tc('cancel'),
                                callback: () => {
                                    if (this.sendConfigPromise) {
                                        console.log('cancelling sending config', configId);
                                        //if we cancel we need to delete the config to ensure we are good
                                        this.sendConfigPromise.cancel();
                                        //we need to delete the broken config on reboot
                                        this.once(GlassesReadyEvent, () => {
                                            this.deleteConfig(configId);
                                        });
                                        //we need to reboot the glasses in this case :s
                                        this.rebootGlasses();
                                    }
                                }
                            }
                        ]
                    });
                    this.sendConfigPromise = this.sendLayoutConfig(path.join(config, 'images.txt'), (progress, current, total) => {
                        onProgress?.(progress, current, total);
                        const perc = Math.round((current / total) * 100);
                        const allTimeForDownloading = ((Date.now() - startTime) * total) / current;
                        const duration = formatDuration(dayjs.duration(allTimeForDownloading), DURATION_FORMAT.SECONDS);

                        ProgressNotification.update(progressNotification, {
                            message: `${fileSize(Math.round(current), { round: 1, pad: true })} (${perc}% / ${duration})`,
                            progressValue: perc
                        });
                        if (progress === 1) {
                            resolve();
                        }
                    });
                    onStart?.(this.sendConfigPromise);
                    await this.sendConfigPromise;
                } catch (error) {
                    reject(error);
                }
            });
            const duration = formatDuration(dayjs.duration(Date.now() - startTime), DURATION_FORMAT.SECONDS);
            DEV_LOG && console.log('sendConfigToGlasses done ', config, Date.now() - startTime, duration);
            showSnack({
                message: $tc('story_sent_glasses', configId, duration)
            });
        } catch (error) {
            throw error;
        } finally {
            ProgressNotification.dismiss(progressNotificationId);
            this.askConfigs();
            this.canDrawOnGlasses = true;
            this.sendConfigPromise = null;
            if (this.toPlayNext) {
                this.toPlayNext();
            }
        }
    }

    async deleteConfig(config: string) {
        DEV_LOG && console.log('deleteConfig', config);
        await this.sendCommand({ command: CommandType.cfgDelete, params: { name: config } });
        this.askConfigs();
    }

    rebootGlasses() {
        if (this.glasses) {
            showSnack({ message: $tc('rebooting_glasses') });
            const data = 0xfd000000;
            const toSend = getUint32(data);
            // ignore write errors. Apparently the glasses can reboot very quickly not letting the time for the write to response correctly
            return bluetooth.write({ peripheralUUID: this.glasses.UUID, serviceUUID: SPOTA_SERVICE_UUID, characteristicUUID: SPOTA_MEM_DEV_UUID, value: toSend }).then(() => {
                this.disconnectGlasses(false); //false to show reconnecting dialog
            });
        }
    }
}
