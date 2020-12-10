import { DEFAULT_MTU, DEFAULT_WRITE_TIMEOUT, ProgressCallback, ProgressListener, timeout } from '../BluetoothHandler';
import { Characteristic, TypedArray } from './Characteristic';
import { bind } from 'helpful-decorators';

export abstract class SendingCharacteristic<T extends ArrayBuffer | string = TypedArray> extends Characteristic {
    toSend?: T;
    sendingSlice = false;
    _mtu = DEFAULT_MTU;
    sliceSize = DEFAULT_MTU;
    writeTimeout = DEFAULT_WRITE_TIMEOUT;
    currentCommandListener: ProgressListener;
    sendWithResponse = false;
    get mtu() {
        return this._mtu;
    }
    set mtu(value) {
        this._mtu = value;
        this.sliceSize = value;
    }
    stopSending(err?) {
        // console.log('stopSending', err);
        this.toSend = null;
        this.sendingSlice = false;
        if (err) {
            this.clearProgressListeners(err);
        } else {
            this.handleFinishSending();
        }
    }
    clearProgressListeners(err) {
        // console.log('clearProgressListeners', !!this.currentCommandListener, err);
        if (this.currentCommandListener) {
            this.currentCommandListener.onProgress(err, null, null);
            this.currentCommandListener = null;
        }
    }
    handleFinishSending() {
        this.sendingSlice = false;
        this.handleProgress(-1);
        // console.log('SendingCharacteristic', 'handleFinishSending', !!this.currentCommandListener);
        this.currentCommandListener = null;
    }
    handleFinishSendingSlice(remainingLength: number) {
        if (!!this.toSend) {
            this.handleProgress(remainingLength);
            if (this.writeTimeout > 0) {
                // dont set the sendingSlice to false right away because of the timeout
                // another  sendSliceData could be called in between because of the flow control
                // one unecessary call would break the state machine
                setTimeout(() => {
                    this.sendingSlice = false;
                    this.sendSliceData();
                }, this.writeTimeout);
            } else {
                this.sendingSlice = false;
                this.sendSliceData();
            }
        } else {
            this.handleFinishSending();
        }
    }
    handleFinishSendingSubslice(remainingSize: number, lastSubslice: boolean) {
        if (!lastSubslice) {
            this.handleProgress(remainingSize);
        }
        if (this.writeTimeout > 0) {
            return timeout(this.writeTimeout);
        }
    }
    async sendSliceData() {
        if (!this.connected) {
            this.stopSending();
            return;
        }
        const length = this.toSend ? this.remainingSendLength() : 0;
        if (length > 0) {
            this.sendingSlice = true;
            const originalSlice = this.slice(this.toSend, 0, this.sliceSize);
            const sliceLength = this.getLength(originalSlice);
            let slice = originalSlice;
            const remainingLength = length - sliceLength;
            if (remainingLength === 0) {
                this.toSend = null;
            } else {
                this.toSend = this.slice(this.toSend, sliceLength);
            }
            const createSublicePromise = async () => {
                let subSlice: T;
                if (this.getLength(slice) > this.mtu) {
                    subSlice = this.slice(slice, 0, this.mtu);
                    slice = this.slice(slice, this.mtu);
                } else {
                    // last slice
                    subSlice = slice;
                    slice = null;
                }
                const sliceRemainingLength = this.getLength(slice);
                const isLast = slice === null;
                if (this.sendWithResponse) {
                    await this.write(subSlice);
                } else {
                    await this.writeWithoutResponse(subSlice);
                }
                await this.handleFinishSendingSubslice(remainingLength + sliceRemainingLength, isLast);
                if (!!slice) {
                    return createSublicePromise();
                }
                // return this.writeWithoutResponse(subSlice)
                //     .then(() => this.handleFinishSendingSubslice(remainingLength + sliceRemainingLength, isLast))
                //     .then(() => {
                //         if (!!slice) {
                //             return createSublicePromise();
                //         }
                //     });
            };
            try {
                await createSublicePromise();
                this.handleFinishSendingSlice(remainingLength);
            } catch (err) {
                console.log('failed to write to char', err);
                // this.toSend = null;
                // this.sending = false;
                this.stopSending(err);
                throw err;
            }
            // return createSublicePromise()
            //     .catch(err => {
            //         console.log('failed to write to char', err);
            //         // this.toSend = null;
            //         // this.sending = false;
            //         this.stopSending(err);
            //         return Promise.reject(err);
            //     })
            //     .then(() => {
            //         // console.log('finished sending slice', remainingLength);
            //         return this.handleFinishSendingSlice(remainingLength);
            //     });
            // this.writeWithoutResponse(slice)
            //     .then(() => {
            //         this.handleProgress(slice.byteLength);
            //     })
            //     .catch(err => {
            //         console.log('failed to write to char', err);
            //         this.toSend = null;
            //         this.sending = false;
            //         this.clearProgressListeners(err);
            //     })
            //     .then(() => {
            //         return this.handleFinishSendingSlice();
            //     });
        } else {
            if (this.sendingSlice) {
                // this.sendingSlice = false;
                // this.handleFinishSending();
                // this.handleProgress(-1);

                this.handleFinishSendingSlice(0);
            }
        }
    }

    remainingSendLength() {
        return this.getLength(this.toSend);
    }

    abstract getLength(data: T): number;
    abstract slice(data: T, start, end?): T;
    abstract concat(data: T, data2: T): T;

    @bind
    handleProgress(remainingLength: number) {
        if (this.currentCommandListener) {
            const listener = this.currentCommandListener;
            if (remainingLength >= 0) {
                // listener.current = Math.min(sentLength, listener.total);
                listener.current = Math.min(listener.total - remainingLength, listener.total);
            } else {
                listener.current = listener.total;
                this.currentCommandListener = null;
            }
            // console.log('handleProgress', sentLength, listener.current / listener.total, listener.total);
            listener.onProgress(null, listener.current / listener.total, listener.total);
        }
    }
    // public sendString(toSend: string, progressCallback?: (error: Error, progress: number) => void) {
    //     return this.sendData(toSend, progressCallback);
    // }
    public sendData(toSend: T, progressCallback?: ProgressCallback) {
        // let buffer: ArrayBuffer;
        // if (toSend instanceof ArrayBuffer) {
        //     buffer = toSend;
        // } else {
        //     buffer = new encoding.TextEncoder('windows-1252').encode(toSend).buffer;
        // }
        // console.log('sendData', toSend, toSend instanceof ArrayBuffer, typeof toSend, buffer, buffer instanceof ArrayBuffer);
        if (progressCallback) {
            this.currentCommandListener = {
                total: this.getLength(toSend) + (this.toSend ? this.remainingSendLength() : 0),
                current: 0,
                onProgress: progressCallback
            };
        }
        if (!this.toSend) {
            this.toSend = toSend;
        } else {
            this.toSend = this.concat(this.toSend, toSend);
            // console.log('sendData concat', this.toSend, this.toSend instanceof ArrayBuffer, typeof this.toSend);
        }
        if (!this.sendingSlice) {
            this.sendSliceData();
        }
    }
}
