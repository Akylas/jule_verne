import { TypedArray } from './Characteristic';
import { SendingCharacteristic } from './SendingCharacteristic';

function concatTypedArrays(a, b) {
    // // Checks for truthy values on both arrays
    if (!a && !b) throw new Error('Please specify valid arguments for parameters a and b.');

    // Checks for truthy values or empty arrays on each argument
    // to avoid the unnecessary construction of a new array and
    // the type comparison
    if (!b || b.length === 0) return a;
    if (!a || a.length === 0) return b;

    // Make sure that both typed arrays are of the same type
    if (Object.prototype.toString.call(a) !== Object.prototype.toString.call(b)) throw new Error('The types of the two arguments passed for parameters a and b do not match.');

    // a, b TypedArray of same type
    const c = new a.constructor(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}
export function concatBuffers(a, b) {
    return concatTypedArrays(a.buffer ? a : new Uint8Array(a), b.buffer ? b : new Uint8Array(b));
}

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
