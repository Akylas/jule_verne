import { CONTROL_CHAR, ProgressCallback } from '../BluetoothHandler';
import { BufferSendingCharacteristic } from './BufferSendingCharacteristic';
import { StringSendingCharacteristic } from './StringSendingCharacteristic';
import { bind } from 'helpful-decorators';
import { CommandType, InputCommandType, buildMessageData } from '../Message';
import { Device } from './Device';

export class GlassesBinaryRXCharacteristic extends BufferSendingCharacteristic<Uint8Array> {
    _canSendData = true;
    sendingCommand = false;
    pendingCommands: {
        data: Uint8Array;
        progressCallback?: ProgressCallback;
    }[] = [];

    constructor(public device: Device, public serviceUUID: string, public characteristicUUID: string) {
        super(device, serviceUUID, characteristicUUID);
        this.writeTimeout = 0; // should be working now!
        this.sendWithResponse = true;
    }
    get canSendData() {
        return this._canSendData;
    }
    set canSendData(value: boolean) {
        if (value === this._canSendData) {
            return;
        }
        this._canSendData = value;
        // console.log('GlassesRXCharacteristic', 'set canSendData', value, !!this.toSend, this.sendingSlice);
        if (value && !this.sendingSlice) {
            if (this.toSend) {
                this.sendSliceData();
            } else {
                this.handleFinishSending();
            }
        }
    }
    sendSliceData() {
        // console.log('GlassesRXCharacteristic', 'sendSliceData', this._canSendData);
        if (this._canSendData) {
            return super.sendSliceData();
        }
        return Promise.resolve();
    }
    sendData(toSend: Uint8Array, progressCallback?: ProgressCallback) {
        // DEV_LOG &&  console.log(this.constructor.name, 'sendData', this._canSendData, toSend);
        if (this._canSendData) {
            super.sendData(toSend, progressCallback);
        }
    }
    clearProgressListeners(err) {
        super.clearProgressListeners(err);
        if (this.pendingCommands.length > 0) {
            this.pendingCommands.forEach((p) => {
                p.progressCallback && p.progressCallback(err, null, null);
            });
        }
    }
    stopSending(err) {
        // console.log('GlassesRXCharacteristic', 'stopSending', err);
        super.stopSending(err);
        this.sendingCommand = false;
        this.pendingCommands = [];
    }
    @bind
    handleFinishSending() {
        // const wasSending = this.sendingCommand;
        // console.log('handleFinishSending', !!wasSending, this._canSendData, this.pendingCommands.length, !!this.currentCommandListener);

        // if (wasSending) {
        // this.handleProgress(-1);
        // }
        this.sendingCommand = false;

        super.handleFinishSending();

        if (this._canSendData) {
            if (this.pendingCommands.length > 0) {
                const data = this.pendingCommands.shift();
                // console.log('handleFinishSending', 'sensding next command', data.data);
                this.sendingCommand = true;
                this.sendData(data.data, data.progressCallback);
                // } else {
                // this.notify({ eventName: FinishSendingEvent, object: this });
            }
        }
    }
    // public sendCommand(command: Uint8Array, progressCallback?: ProgressCallback, withControlChar = true) {
    //     // console.log('sendCommand', command, command.length, this.connected, this.canSendData, this.sendingCommand, this.pendingCommands.length, this.sendingSlice);
    //     if (withControlChar) {
    //         command += CONTROL_CHAR;
    //     }
    //     // console.log('sendCommand', command);
    //     if (!this.connected) {
    //         return;
    //     }
    //     if (this.sendingCommand || this.sendingSlice || !this.canSendData) {
    //         this.pendingCommands.push({ data: command, progressCallback });
    //         return;
    //     }
    //     this.sendingCommand = true;
    //     this.sendData(command, progressCallback);
    // }

    public sendBinaryCommand<T extends CommandType>(commandType: T, options: { timestamp?: number; params?: InputCommandType<T>; progressCallback?: ProgressCallback } = {}) {
        if (!this.connected) {
            return;
        }
        // only for debug purpose!
        // options.timestamp = options.timestamp || Date.now()
        const messageData = buildMessageData<T>(commandType, options);
        const shouldStack = this.sendingCommand || this.sendingSlice || !this.canSendData;
        if (shouldStack) {
            this.pendingCommands.push({ data: messageData, progressCallback: options.progressCallback });
            return;
        }
        this.sendingCommand = true;
        this.sendData(messageData, options.progressCallback);
    }
}
