import { SendingCharacteristic } from './SendingCharacteristic';
export class StringSendingCharacteristic extends SendingCharacteristic<string> {
    concat(data: string, data2: string): string {
        return data.concat(data2);
    }
    slice(data: string, start: any, end?: any): string {
        return data.slice(start, end);
    }
    getLength(data: string) {
        return data ? data.length : 0;
    }
}
