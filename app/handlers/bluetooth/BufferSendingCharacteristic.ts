import { concatBuffers } from '../Message';
import { TypedArray } from './Characteristic';
import { SendingCharacteristic } from './SendingCharacteristic';

export class BufferSendingCharacteristic<T extends ArrayBuffer = TypedArray> extends SendingCharacteristic<T> {
    concat(data: T, data2: T): T {
        return concatBuffers(data, data2);
    }
    slice(data: T, start: any, end?: any): T {
        return data.slice(start, end) as T;
    }
    getLength(data: T) {
        return data ? data.byteLength : 0;
    }
}
