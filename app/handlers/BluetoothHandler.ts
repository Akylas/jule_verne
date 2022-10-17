import { Bluetooth, StartScanningOptions as IStartScanningOptions, Peripheral, ReadResult, StartNotifyingOptions } from '@nativescript-community/ble';
import { isSimulator } from '@nativescript-community/extendedinfo';
import { request } from '@nativescript-community/perms';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { File, Utils } from '@nativescript/core';
import * as appSettings from '@nativescript/core/application-settings';
import { EventData } from '@nativescript/core/data/observable';
import { Vibrate } from 'nativescript-vibrate';
import Vue from 'vue';
import { getUint32 } from '~/handlers/bluetooth/SuotaCharacteristic';
import { SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { CommandType, ConfigListData, FULLSCREEN, FreeSpaceData, InputCommandType, Message } from '~/handlers/Message';
import { $t, $tc } from '~/helpers/locale';
import { BgServiceCommon } from '~/services/BgService.common';
import { GlassesError, MessageError } from '~/services/CrashReportService';
import { permResultCheck, timeout, versionCompare } from '~/utils';
import { alert, confirm } from '~/utils/dialogs';
import { Characteristic } from './bluetooth/Characteristic';
import { GlassesDevice } from './bluetooth/GlassesDevice';
import { Handler } from './Handler';
import { PlayImagesOptions } from './StoryHandler';

export const ACTION_BT_HEADSET_STATE_CHANGED = 'android.bluetooth.headset.action.STATE_CHANGED';
export const ACTION_AUDIO_STATE_CHANGED = '"android.bluetooth.headset.profile.action.AUDIO_STATE_CHANGED';
const STATE_CONNECTED = 0x00000002;
const STATE_DISCONNECTED = 0x00000000;
const EXTRA_STATE = 'android.bluetooth.profile.extra.STATE';

export const HeadSetConnectedEvent = 'headSetConnectedEvent';
export const HeadSetDisconnectedEvent = 'headSetDisconnectedEvent';
export const HeadSetBatteryEvent = 'headSetBatteryEvent';

@NativeClass
class BroadcastReceiver extends android.content.BroadcastReceiver {
    private _onReceiveCallback: (context: android.content.Context, intent: android.content.Intent) => void;

    constructor(onReceiveCallback: (context: android.content.Context, intent: android.content.Intent) => void) {
        super();
        this._onReceiveCallback = onReceiveCallback;

        return global.__native(this);
    }

    public onReceive(context: android.content.Context, intent: android.content.Intent) {
        if (this._onReceiveCallback) {
            this._onReceiveCallback(context, intent);
        }
    }
}

function getBluetoothDeviceBatterLevel(device: android.bluetooth.BluetoothDevice) {
    try {
        const method = device.getClass().getMethod('getBatteryLevel', null);
        const result = (method.invoke(device, null) as java.lang.Integer).intValue();
        return result;
    } catch (ex) {
        console.error('getBluetoothDeviceBatterLevel', ex);
        return -1;
    }
}

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

export function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return new Uint8Array(bytes);
}

export interface HeadSet {
    name: string;
    battery: number;
    address: string;
}

export type CancelPromise<T = void> = Promise<T> & { cancel() };

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

export interface Command<T extends CommandType = any> {
    commandType: T;
    params?: InputCommandType<T>;
}

const TAG = '[Bluetooth]';

export class BluetoothHandler extends Handler {
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

    connectedHeadsetUUID: string = null;

    devLog: Message<any>[];
    currentConfigs: ConfigListData = null;

    needsPowerOn = true;
    isScreenOn = true;
    isSensorOn = true;
    isGestureOn = true;
    levelLuminance = 10;

    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
        if (this._devMode) {
            this.devLog = [];
        }
    }
    constructor(service: BgServiceCommon) {
        super(service);
        if (!bluetooth) {
            bluetooth = new Bluetooth('myCentralManagerIdentifier');
        }
        DEV_LOG && console.log(TAG, 'constructor', !!bluetooth);
    }

    async stop() {
        TEST_LOG && console.log(TAG, 'stop');
        this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
        this.cancelConnections();
        this.connectingToSavedGlasses = false;
        await this.disconnectGlasses(true);
        Utils.ad.getApplicationContext().unregisterReceiver(this.bluetoothHeadsetReceiver);
        this.mProfileListener = null;
        this.bluetoothHeadsetReceiver = null;

        bluetooth.off(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.off(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.off(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);
        // we clear the bluetooth module on stop or it will be in a bad state on restart (not forced kill) on android.
        bluetooth = null;
        DEV_LOG && console.log(TAG, 'stop done');
    }
    bluetoothHeadsetReceiver: BroadcastReceiver;
    mProfileListener: android.bluetooth.BluetoothProfile.ServiceListener;
    mBluetoothHeadset: android.bluetooth.BluetoothHeadset;
    mConnectedHeadset: HeadSet;

    get connectedHeadset() {
        return this.mConnectedHeadset;
    }
    async start() {
        TEST_LOG && console.log(TAG, 'start');
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        this.bluetoothEnabled = await this.isEnabled();
        bluetooth.on(Bluetooth.bluetooth_status_event, this.onBLEStatusChange, this);
        bluetooth.on(Bluetooth.device_connected_event, this.onDeviceConnected, this);
        bluetooth.on(Bluetooth.device_disconnected_event, this.onDeviceDisconnected, this);

        this.mProfileListener = new android.bluetooth.BluetoothProfile.ServiceListener({
            onServiceConnected: (profile, proxy) => {
                if (profile === android.bluetooth.BluetoothProfile.HEADSET) {
                    this.mBluetoothHeadset = proxy as any;
                    this.updateHeadsetState();
                }
            },

            onServiceDisconnected: (profile) => {
                if (profile === android.bluetooth.BluetoothProfile.HEADSET) {
                    this.mBluetoothHeadset = null;
                }
            }
        });
        try {
            await request('bluetoothConnect');
            (bluetooth['adapter'] as android.bluetooth.BluetoothAdapter).getProfileProxy(Utils.ad.getApplicationContext(), this.mProfileListener, android.bluetooth.BluetoothProfile.HEADSET);

            // Register receivers for BluetoothHeadset change notifications.
            const bluetoothHeadsetFilter = new android.content.IntentFilter('android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED');
            this.bluetoothHeadsetReceiver = new BroadcastReceiver((context: android.content.Context, intent: android.content.Intent) => {
                const action = intent.getAction();
                if (action === null) {
                    return;
                }

                const extraData = intent.getIntExtra(EXTRA_STATE, STATE_DISCONNECTED);
                if (extraData === STATE_CONNECTED) {
                    this.updateHeadsetState();
                } else if (extraData === STATE_DISCONNECTED) {
                    this.updateHeadsetState();
                }
            });
            Utils.ad.getApplicationContext().registerReceiver(this.bluetoothHeadsetReceiver, bluetoothHeadsetFilter);
        } catch (err) {
            console.error('error starting headset monitor', err);
        }
    }

    updateHeadsetState() {
        const result: HeadSet[] = [];
        if (this.mBluetoothHeadset) {
            const connectedDevices = this.mBluetoothHeadset.getConnectedDevices().toArray();
            if (connectedDevices.length > 0) {
                for (let index = 0; index < connectedDevices.length; index++) {
                    const device = connectedDevices[index] as android.bluetooth.BluetoothDevice;
                    result.push({
                        name: device.getName(),
                        address: device.getAddress(),
                        battery: getBluetoothDeviceBatterLevel(device)
                    });
                }
            }
        }
        if (result.length > 0) {
            if (!this.mConnectedHeadset || this.mConnectedHeadset.address !== result[0].address) {
                this.mConnectedHeadset = result[0];
                DEV_LOG && console.log(TAG, 'headset connected', this.mConnectedHeadset);
                this.notify({ eventName: HeadSetConnectedEvent, data: this.mConnectedHeadset });
            } else if (this.mConnectedHeadset.battery !== result[0].battery) {
                this.mConnectedHeadset.battery = result[0].battery;
                DEV_LOG && console.log(TAG, 'headset battery changed', this.mConnectedHeadset);
                this.notify({ eventName: HeadSetBatteryEvent, data: this.mConnectedHeadset });
            }
        } else if (this.mConnectedHeadset) {
            DEV_LOG && console.log(TAG, 'headset disconnected', this.mConnectedHeadset);
            this.notify({ eventName: HeadSetDisconnectedEvent, data: this.mConnectedHeadset });
            this.mConnectedHeadset = null;
        }
        return result;
    }
    bluetoothEnabled = false;
    onBLEStatusChange(e: BluetoothEvent) {
        const enabled = e.data.state === 'on';
        TEST_LOG && console.log(TAG, 'onBLEStatusChange', this.bluetoothEnabled, enabled);
        if (this.bluetoothEnabled !== enabled) {
            this.bluetoothEnabled = enabled;
            if (!enabled) {
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
                data: enabled
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
    connectToSavedGlasses(seconds = 10): Promise<boolean> {
        let foundGlasses = false;
        return new Promise((resolve, reject) => {
            this.startScanning({
                seconds,
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
        DEV_LOG && console.log(TAG, 'cancelConnections');
        if (this.connectingToGlasses) {
            this.stopScanning();
        }
        Object.keys(this.connectingDevicesUUIDs).forEach((k) => this.disconnect(k, true));
    }

    async cancelConnectToSave() {
        DEV_LOG && console.log(TAG, 'cancelConnectToSave', this.connectingToGlasses);
        // if (this.connectingToGlasses) {
        this.stopScanning();
        // }
    }
    async connectToSaved(seconds = 10) {
        if (!this.connectingToGlasses && !this.glasses && !!this.savedGlassesUUID) {
            DEV_LOG && console.log(TAG, 'connectToSaved', 'start', this.savedGlassesUUID);
            if (__ANDROID__) {
                await this.geoHandler.enableLocation();
            }
            if (!this.glasses && !!this.savedGlassesUUID) {
                const found = await this.connectToSavedGlasses(seconds);
            }
            return this.connectingToGlasses || !!this.glasses;
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
                throw new Error('bluetooth_denied');
            }
            return r;
        }
    }
    async enableForScan() {
        await this.authorizeBluetooth();
        let enabled = await this.isEnabled();
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
                    console.error('enableForScan', err, err.stack);
                }
                enabled = await this.isEnabled();
            }
        }
        await this.geoHandler.checkAuthorizedAndEnabled();
        if (!this.geoHandler.gpsEnabled || !enabled) {
            return Promise.reject(undefined);
        }
    }

    async onDeviceConnected(e: BluetoothDeviceEvent) {
        const data = e.data;
        const options = this.connectingDevicesUUIDs[data.UUID];
        // console.log(TAG, 'onDeviceConnected but not discovered', data.UUID, data.name, data.localName, data.advertismentData);
        try {
            const result = await bluetooth.discoverAll({ peripheralUUID: data.UUID });
            // we do the discovery ourself so copy it
            data.services = result.services;
            DEV_LOG &&
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
                    SENTRY_ENABLED && Vue.prototype.$crashReportService.setExtra('glasses', JSON.stringify(this.glasses.toJSON()));
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
                    // TODO: for now we disable gestures and sensor
                    this.activateSensor(false);
                    this.activateGesture(false);
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
                // this.setConfig('nav');
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
        let data = e.data;
        const UUID = data.UUID;
        DEV_LOG && console.log(TAG, 'onDeviceDisconnected', !!this.glasses, this.glasses && UUID === this.glasses.UUID);
        this.removeConnectingDeviceUUID(data.UUID);

        if (this.glasses && UUID === this.glasses.UUID) {
            data = this.glasses;
            this.notify({ eventName: AvailableConfigsEvent, data: null });
            this.glasses.onDisconnected();
            this.glasses = null;
            this.currentGlassesMemory = null;
            this.currentConfigs = null;
            // this.isEnabled().then((enabled) => {
            const manualDisconnect = !!this.manualDisconnect[UUID] || !this.bluetoothEnabled;
            DEV_LOG && console.log(TAG, 'GlassesDisconnectedEvent', manualDisconnect);
            SENTRY_ENABLED && Vue.prototype.$crashReportService.setExtra('glasses', null);
            this.notify({
                eventName: GlassesDisconnectedEvent,
                object: this,
                manualDisconnect,
                data
            } as BLEConnectionEventData);
            DEV_LOG && console.log(TAG, 'GlassesDisconnectedEvent done', manualDisconnect);
            if (this.devMode) {
                const vibrator = new Vibrate();
                vibrator.vibrate(2000);
            }
            if (!manualDisconnect && !this.connectingToGlasses && !this.glasses && !!this.savedGlassesUUID) {
                DEV_LOG && console.log(TAG, 'glasses disconnected after error, trying to reconnect');
                this.notify({
                    eventName: GlassesReconnectingEvent,
                    object: this,
                    data
                });
                // we need 30s because if the deconnection was after a firmware update
                // the glasses can take quite some time to reboot
                this.connectToSaved(30)
                    .catch((err) => console.error(err))
                    .then((result) => {
                        DEV_LOG && console.log(TAG, 'glasses reconnection done', result);
                        if (!result) {
                            this.notify({
                                eventName: GlassesReconnectingFailedEvent,
                                object: this,
                                data
                            });
                        }
                    });
            } else {
                delete this.manualDisconnect[UUID];
            }
            // });
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
    async connect(UUID: string, glassesName?) {
        DEV_LOG && console.log('connect', UUID, glassesName);
        try {
            this.connectingDevicesUUIDs[UUID] = {};
            if (glassesName) {
                this.savedGlassesName = glassesName;
            }
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
                // this.geoHandler.setReadableStories(
                //     list
                //         .map((c) => parseInt(c.name, 10))
                //         .filter((s) => !isNaN(s))
                //         .sort()
                // );
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
                DEV_LOG && console.log('on glasses settings', JSON.stringify(settings));
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
    public sendCommands(commands: Command[], options: { progressCallback?: ProgressCallback } = {}) {
        if (!this.glasses) {
            return;
        }
        return this.glasses.sendCommands(commands, options);
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
        level = Math.min(15, Math.max(0, level));
        this.levelLuminance = level;
        // appSettings.setNumber('levelLuminance', level);
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
        DEV_LOG && console.log('askSettings');
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
                        appSettings.setString('savedGlassesName', name);
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
            DEV_LOG && console.log('glasses versions', JSON.stringify(versions));

            this.notify({
                eventName: VersionEvent,
                object: this,
                data: versions
            });
            return versions;
        } catch (error) {
            console.error('readGlassesVersions', error, error.stack);
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
            console.error('readSerialNumber', error, error.stack);
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
            console.error('readBattery', error, error.stack);
        }
    }
    async readHeadsetBattery() {
        if (!this.connectedHeadsetUUID) {
            return;
        }
        try {
            const data = await Characteristic.read(this.connectedHeadsetUUID, BATTERY_UUID, BATTERY_DESC_UUID);
            this.onBatteryReading({ value: data.buffer } as any);
        } catch (error) {
            console.error('readHeadsetBattery', error, error.stack);
        }
    }
    async readParamValue(chUUID: string) {
        try {
            const buffer = await this.glasses.readDescriptor(SPOTA_SERVICE_UUID, chUUID);
            return (buffer[1] << 8) | buffer[0];
        } catch (error) {
            console.error('readParamValue', error, error.stack);
        }
    }
    sendRawCommands(commandsToSend: (number[] | Uint8Array)[], onProgress?: (progress, current, total) => void) {
        let cancelled = false;
        const promise = new Promise<void>((resolveUp, rejectUp) => {
            const datalength = commandsToSend.reduce((accumulator, currentValue) => accumulator + currentValue.length, 0);
            let dataSent = 0;

            //TODO: we re enabled sendWithResponse cause it was causing errors
            // slower but works ...
            // this.glasses.rxChar.sendWithResponse = false;
            // this.glasses.rxChar.writeTimeout = ApplicationSettings.getNumber('sendStoryWriteTimeout', 1);
            const promisedCallback = (resolve, reject) => (err, progress, total) => {
                if (err || cancelled) {
                    return reject(err);
                }
                const p = (progress * total + dataSent) / datalength;
                onProgress?.(p, progress * total + dataSent, datalength);
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
                        rejectUp();
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
            .map((s) => (s.startsWith('0x') ? s.slice(2) : s))
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

    async demoLoop(bmpIndex: number, count = 3, pauseOnFirst = false, duration = 200) {
        for (let index = 0; index < count; index++) {
            await this.glasses.sendCommand(CommandType.imgDisplay, { params: [bmpIndex + index, 0, 0] });
            await timeout(pauseOnFirst && index === 0 ? 1000 : duration);
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
    async clearFadeout() {
        if (FADING_SUPPORTED && this.isFaded) {
            this.isFaded = false;
            if (this.glasses) {
                this.glasses.sendCommand(CommandType.Clear);
                this.sendDim(100);
            }
        }
    }

    async sendDim(percentage: number) {
        if (FADING_SUPPORTED) {
            return this.glasses.sendCommand(CommandType.Dim, { params: [percentage] });
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
    drawImage(data: [number, number, number, number, number, string], options: PlayImagesOptions = {}) {
        if (this.glasses && data) {
            const commands = [];
            if (options.useCrop) {
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
                params: data.slice(0, 3)
            });
            if (options.useCrop) {
                commands.push({
                    commandType: CommandType.HoldFlushw,
                    params: [1]
                });
            }
            this.sendCommands(commands);
            // await this.glasses.sendCommand(CommandType.Bitmap, { params: [bmpIndex + index, 0, 0] });
        }
    }
}
