import { CONTROL_CHAR, ProgressCallback } from '../BluetoothHandler';
import { StringSendingCharacteristic } from './StringSendingCharacteristic';
import { bind } from 'helpful-decorators';
import { CommandType, Message } from '../Message';

export class GlassesRXCharacteristic extends StringSendingCharacteristic {
    _canSendData = true;
    sendingCommand = false;
    pendingCommands: {
        data: string;
        progressCallback?: ProgressCallback;
    }[] = [];
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
    sendData(toSend: string, progressCallback?: ProgressCallback) {
        // console.log('sendData', this._canSendData, this.sending, toSend.length);
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
    public sendCommand(command: string, progressCallback?: ProgressCallback, withControlChar = true) {
        if (withControlChar) {
            command += CONTROL_CHAR;
        }
        // console.log('sendCommand', command);
        if (!this.connected) {
            return;
        }
        if (this.sendingCommand || this.sendingSlice || !this.canSendData) {
            this.pendingCommands.push({ data: command, progressCallback });
            return;
        }
        this.sendingCommand = true;
        this.sendData(command, progressCallback);
    }
}
