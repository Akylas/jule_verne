import { Peripheral, ReadResult } from '@nativescript-community/ble';
import { BluetoothHandler, FLOW_SERVER_UUID, GlassesSettings, ProgressCallback, RX_SERVER_UUID, SERVER_SERVICE_UUID, TX_SERVER_UUID } from '../BluetoothHandler';
import { Characteristic } from './Characteristic';
import { Device } from './Device';
import { GlassesRXCharacteristic } from './GlassesRXCharacteristic';
import { GlassesBinaryRXCharacteristic } from './GlassesBinaryRXCharacteristic';
import { CommandType, InputCommandType, Message, MessageParser, ParseResult } from '../Message';

export const GESTURE_CHAR_UUID = '0783b03e-8535-b5a0-7140-a304d2495cbb';
export const BUTTON_CHAR_UUID = '0783b03e-8535-b5a0-7140-a304d2495cbc';

// const BinaryCmdToString = {
//     [CommandType.Version]: 'vers',
//     [CommandType.Power]: 'power',
//     [CommandType.Clear]: 'clear',
//     [CommandType.Color]: 'color',
//     [CommandType.Bitmap]: 'bitmap',
//     [CommandType.Battery]: 'battery',
//     [CommandType.Settings]: 'settings',
//     [CommandType.Als]: 'als',
//     [CommandType.Gesture]: 'gesture',
//     [CommandType.Rectf]: 'rectf',
//     [CommandType.Shift]: 'shift',
//     [CommandType.Luma]: 'luma',
//     [CommandType.Layout]: 'layout',
//     [CommandType.Txt]: 'txt'
// };

export class GlassesDevice extends Device {
    firmwareVersion: string;
    serialNumber: string;
    currentConfig?: string;
    /**
     * defines if the glasses firmware supports settings saving / loading
     */
    supportSettings = false;
    /**
     * glasses settings currently read
     */
    hasFlowControl = false;
    binaryFormat = false;
    settings: GlassesSettings;
    txChar: Characteristic;
    rxChar: GlassesRXCharacteristic | GlassesBinaryRXCharacteristic;
    parser: MessageParser;

    messagePromises: { [key: string]: { resolve: Function; reject: Function; timeoutTimer: any }[] } = {};

    _gestureOn: boolean = undefined;
    _alsOn: boolean = undefined;

    get gestureOn() {
        return this._gestureOn;
    }
    set gestureOn(value: boolean) {
        if (this._gestureOn !== value) {
            this._gestureOn = value;
            console.log('gestureOn', value);
            if (this.binaryFormat) {
                if (value) {
                    Characteristic.startNotifying(this.UUID, SERVER_SERVICE_UUID, GESTURE_CHAR_UUID, this.onGesture.bind(this));
                    Characteristic.startNotifying(this.UUID, SERVER_SERVICE_UUID, BUTTON_CHAR_UUID, this.onTap.bind(this));
                } else {
                    Characteristic.stopNotifying(this.UUID, SERVER_SERVICE_UUID, GESTURE_CHAR_UUID);
                    Characteristic.stopNotifying(this.UUID, SERVER_SERVICE_UUID, BUTTON_CHAR_UUID);
                }
            } else {
                this.sendCommand(CommandType.Gesture, { params: [value ? 'on' : 'off'] });
            }
        }
    }
    get alsOn() {
        return this._alsOn;
    }
    set alsOn(value: boolean) {
        if (this._alsOn !== value) {
            this._alsOn = value;
        }
    }

    constructor(public peripheral: Peripheral, protected bluetoothHandler: BluetoothHandler) {
        super(peripheral, bluetoothHandler);
        const index = peripheral.services.findIndex((s) => s.UUID.toLowerCase() === SERVER_SERVICE_UUID);
        const chars = peripheral.services[index].characteristics;
        // console.log('chars ', chars);

        this.binaryFormat = chars.findIndex((c) => c.UUID.toLowerCase() === GESTURE_CHAR_UUID) !== -1;
        this.hasFlowControl = chars.findIndex((c) => c.UUID.toLowerCase() === FLOW_SERVER_UUID) !== -1;
        DEV_LOG && console.log('binaryFormat ', this.binaryFormat);
        DEV_LOG && console.log('hasFlowControl ', this.hasFlowControl);

        this.txChar = new Characteristic(this, SERVER_SERVICE_UUID, TX_SERVER_UUID);
        if (this.binaryFormat) {
            this.rxChar = new GlassesBinaryRXCharacteristic(this, SERVER_SERVICE_UUID, RX_SERVER_UUID);
            this.parser = new MessageParser(this.onMessage.bind(this));
        } else {
            this.rxChar = new GlassesRXCharacteristic(this, SERVER_SERVICE_UUID, RX_SERVER_UUID);
        }
        this.rxChar.mtu = this.mtu;
        // this.rxChar.writeTimeout = 10;
    }
    get canSendData() {
        return this.rxChar.canSendData;
    }
    set canSendData(value: boolean) {
        this.rxChar.canSendData = value;
    }
    public sendCommand<T extends CommandType>(
        commandType: T,
        options: { params?: InputCommandType<T>; timestamp?: number; progressCallback?: ProgressCallback; timeout?: number } = {}
    ): Promise<Message<T>> {
        // if (this.binaryFormat) {
        // console.log('sendCommand', CommandType[commandType], options);
        if (options.timestamp) {
            const id = options.timestamp;
            return new Promise((resolve, reject) => {
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
                (this.rxChar as GlassesBinaryRXCharacteristic).sendBinaryCommand(commandType, options);
            });
        } else {
            (this.rxChar as GlassesBinaryRXCharacteristic).sendBinaryCommand(commandType, options);
        }
        // } else {
        //     const stringToSend = BinaryCmdToString[commandType] + (options.params ? ' ' + options.params.join(' ') : '');
        //     (this.rxChar as GlassesRXCharacteristic).sendCommand(stringToSend, options.progressCallback, true);
        // }
    }
    // sendCommand(command: string, progressCallback?: ProgressCallback, withControlChar = true) {
    //     this.rxChar.sendCommand(command, progressCallback, withControlChar);
    // }

    listenForMessage() {
        return this.txChar.startNotifying((result: ReadResult) => {
            this.parseMessage(result.value);
        });
    }
    onDisconnected() {
        console.log('GlassesDevice', 'onDisconnected');
        super.onDisconnected();
        this.txChar.connected = false;
        this.rxChar.connected = false;
        this.rxChar.stopSending(new Error('disconnected'));
    }
    setMtu(value: number) {
        super.setMtu(value);
        this.rxChar.mtu = value;
    }

    onMessage(message: Message<any>) {
        const id = message.queryId;
        // console.log('onMessage', id, message);
        if (id && this.messagePromises.hasOwnProperty(id)) {
            this.messagePromises[id].forEach(function (executor) {
                executor.timeoutTimer && clearTimeout(executor.timeoutTimer);
                executor.resolve(message);
            });
            delete this.messagePromises[id];
        }
        this.notify({
            eventName: 'message',
            object: this,
            message
        });
    }

    onGesture() {
        this.notify({
            eventName: 'swipe',
            object: this
        });
    }
    onTap() {
        this.notify({
            eventName: 'tap',
            object: this
        });
    }

    parseMessage(value) {
        if (this.binaryFormat) {
            this.parser.parseData(new Uint8Array(value));
        } else {
            let message: Message<any>;
            const arr = new Uint8Array(value);
            const str = String.fromCharCode.apply(String, arr) as string;
            // if (str === 'power down') {
            //     message = {
            //         commandType: CommandType.PowerDown
            //     };
            // } else
            if (str === 'TAP') {
                this.onTap();
            } else if (str === 'SWIPE') {
                this.onGesture();
            } else if (str.indexOf('/') !== -1) {
                const array = str.split('/');

                message = {
                    commandType: CommandType.Settings,
                    data: {
                        shift: {
                            x: parseFloat(array[0].slice(1)),
                            y: parseFloat(array[1].slice(1))
                        },
                        luma: parseFloat(array[2].slice(1)),
                        als: !!parseFloat(array[3].slice(1)),
                        gesture: !!parseFloat(array[4].slice(1))
                    }
                };
            }
            if (message) {
                this.onMessage(message);
            }
        }
    }
}
