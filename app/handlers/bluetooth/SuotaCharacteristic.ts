import { SPOTA_PATCH_LEN_UUID, SPOTA_SERVICE_UUID } from '~/handlers/BluetoothHandler';
import { Characteristic } from '~/handlers/bluetooth/Characteristic';
import { BufferSendingCharacteristic } from '~/handlers/bluetooth/BufferSendingCharacteristic';
import { bind } from 'helpful-decorators';

export function getUint16(value) {
    const dv = new DataView(new ArrayBuffer(2));
    dv.setUint16(0, value, true);
    const toSend = new Int8Array(dv.buffer);
    return toSend;
}
export function getUint32(value) {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, value, true);
    const toSend = new Int8Array(dv.buffer);
    return toSend;
}

export class SuotaCharacteristic extends BufferSendingCharacteristic {
    waitingForStatus: boolean;
    @bind
    onStatus(status) {
        if (!this.waitingForStatus) {
            return;
        }
        this.sendingSlice = false;
        if (status === 0x02) {
            if (!!this.toSend) {
                this.sendSliceData();
            } else {
                this.handleFinishSending();
            }
        } else {
            this.stopSending(new Error('wrong_status'));
        }
    }
    handleFinishSendingSubslice(remainingSize: number, lastSubslice: boolean) {
        this.waitingForStatus = true;
        return super.handleFinishSendingSubslice(remainingSize, lastSubslice);
    }
    handleFinishSendingSlice(remainingLength: number) {
        if (!!this.toSend) {
            this.handleProgress(remainingLength);
            if (remainingLength < this.blockSize) {
                return this.setBlockSize(remainingLength);
            }
        } else {
            this.handleFinishSending();
        }
    }
    blockSize: number;
    setBlockSize(blockSize) {
        this.blockSize = blockSize;
        this.sliceSize = blockSize;
        const toSend = getUint16(blockSize);
        return Characteristic.write(this.peripheralUUID, SPOTA_SERVICE_UUID, SPOTA_PATCH_LEN_UUID, toSend);
    }
}
