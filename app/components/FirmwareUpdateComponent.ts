import { ReadResult } from '@nativescript-community/ble';
import { File } from '@nativescript/core/file-system';
import {
    SPOTA_GPIO_MAP_UUID,
    SPOTA_MEM_DEV_UUID,
    SPOTA_PATCH_DATA_UUID,
    SPOTA_SERVICE_UUID,
    SPOTA_SERV_STATUS_UUID,
    SUOTA_L2CAP_PSM_UUID,
    SUOTA_MTU_UUID,
    SUOTA_PATCH_DATA_CHAR_SIZE_UUID,
    SUOTA_VERSION_UUID,
    bluetooth
} from '~/handlers/BluetoothHandler';
import { concatBuffers } from '~/handlers/Message';
import { confirm } from '~/utils/dialogs';
import { SuotaCharacteristic, getUint32 } from '../handlers/bluetooth/SuotaCharacteristic';
import GlassesConnectionComponent from './GlassesConnectionComponent';

const TAG = '[FirmwareUpdate]';

export default class FirmwareUpdateComponent extends GlassesConnectionComponent {
    inFront = true;
    public currentProgress: number = 0;
    public updatingFirmware = false;

    firmwareRunLog = '';

    get devMode() {
        return this.$getDevMode();
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    rebootGlasses() {
        const data = 0xfd000000;
        const toSend = getUint32(data);
        this.fLog('writing SPOTA_MEM_DEV_UUID (reboot command)', data);
        // ignore write errors. Apparently the glasses can reboot very quickly not letting the time for the write to response correctly
        return bluetooth
            .write({ peripheralUUID: this.connectedGlasses.UUID, serviceUUID: SPOTA_SERVICE_UUID, characteristicUUID: SPOTA_MEM_DEV_UUID, value: toSend })
            .then(() => {
                this.bluetoothHandler.disconnectGlasses(false); //false to show reconnecting dialog
            })
            .catch(console.error);
    }

    fLog(...args) {
        DEV_LOG && console.log(TAG, ...args);
        this.firmwareRunLog += args.join(' ') + '\n';
    }
    readParamValue(chUUID: string) {
        return this.connectedGlasses.readDescriptor(SPOTA_SERVICE_UUID, chUUID).then((buffer) => {
            const result = (buffer[1] << 8) | buffer[0];
            // console.log(TAG, 'readParamValue', chUUID, result);
            return result;
        });
    }
    async updateFirmware(file: string | File) {
        DEV_LOG && console.log('updateFirmware', file);
        let theFile: File;
        if (typeof file === 'string') {
            theFile = File.fromPath(file);
        } else {
            theFile = file;
        }
        if (!File.exists(theFile.path)) {
            throw new Error('firmware file missing:' + theFile.path);
        }
        this.updatingFirmware = true;
        const glasses = this.connectedGlasses;
        this.fLog('update firmware start', !!glasses);

        const memoryType = 0x13;
        const memoryBank = 0;
        let blockSize = 240,
            suotaMtu = 23,
            suotaVersion = 0,
            suotaPatchDataSize = 20,
            suotaL2CapPsm = 0;

        const onStatusListener: { onStatus: (status) => void }[] = [];
        const onStatus = (event: ReadResult) => {
            const status = new Uint8Array(event.value)[0];
            // console.log(TAG, 'onStatus', status);
            onStatusListener.forEach((s) => {
                s.onStatus(status);
            });
        };
        function addStatusListener(l: { onStatus: (status) => void }) {
            const index = onStatusListener.indexOf(l);
            if (index === -1) {
                onStatusListener.push(l);
            }
        }
        function removeStatusListener(l: { onStatus: (status) => void }) {
            const index = onStatusListener.indexOf(l);
            if (index !== -1) {
                onStatusListener.splice(index, 1);
            }
        }

        function appendChecksum(tArray: any) {
            let crc_code = 0;

            for (let i = 0; i < tArray.byteLength; i++) {
                crc_code ^= tArray[i];
            }
            const arr = new Int8Array(1);
            arr[0] = crc_code;
            return concatBuffers(tArray, arr);
        }

        const runForStatus = (runner: () => Promise<any>, expectedStatus) => {
            DEV_LOG && console.log(TAG, 'runForStatus', expectedStatus);
            let returnedStatus = -1,
                toResolve,
                toReject,
                result,
                timeout;
            const listener = {
                onStatus: (status) => {
                    returnedStatus = status;
                    this.fLog('runForStatus on status', status, expectedStatus);
                    if (toResolve) {
                        clearTimeout(timeout);
                        if (returnedStatus === expectedStatus) {
                            toResolve(result);
                        } else {
                            toReject(`wrong status: ${status} instead of ${expectedStatus}`);
                        }
                        toResolve = toReject = result = timeout = null;
                    }
                    removeStatusListener(listener);
                }
            };
            addStatusListener(listener);
            return runner().then(
                (r) =>
                    new Promise((resolve, reject) => {
                        DEV_LOG && console.log(TAG, 'after runner', returnedStatus);
                        if (returnedStatus !== -1) {
                            // status already returned
                            if (returnedStatus === expectedStatus) {
                                return resolve(r);
                            } else {
                                return reject(new Error(this.$t('wrong_status')));
                            }
                        } else {
                            // no status yet
                            toResolve = resolve;
                            toReject = reject;
                            result = r;
                            timeout = setTimeout(() => {
                                this.fLog('calling timeout', expectedStatus, timeout);
                                timeout = null;
                                removeStatusListener(listener);
                                reject(new Error(this.$t('timeout')));
                            }, 2000);
                        }
                    })
            );
        };

        const writeValueForStatus = (serviceUUID, charUUID, data, expectedStatus) => {
            DEV_LOG && console.log(TAG, 'writeValueForStatus', serviceUUID, charUUID, data);
            return runForStatus(() => {
                const toSend = getUint32(data);
                DEV_LOG && console.log(TAG, 'write', serviceUUID, charUUID, data, toSend);
                return bluetooth.write({ peripheralUUID: glasses.UUID, serviceUUID, characteristicUUID: charUUID, value: toSend });
            }, expectedStatus);
        };
        try {
            this.fLog('Enable notifications on SPOTA_SERV_STATUS_UUID');
            await bluetooth.startNotifying({
                peripheralUUID: glasses.UUID,
                serviceUUID: SPOTA_SERVICE_UUID,
                characteristicUUID: SPOTA_SERV_STATUS_UUID,
                onNotify: onStatus
            });
            this.fLog('reading SUOTA params');
            await Promise.all([
                this.readParamValue(SUOTA_VERSION_UUID).then((r) => (suotaVersion = r)),
                this.readParamValue(SUOTA_PATCH_DATA_CHAR_SIZE_UUID).then((r) => (suotaPatchDataSize = r)),
                this.readParamValue(SUOTA_MTU_UUID).then((r) => (suotaMtu = r)),
                this.readParamValue(SUOTA_L2CAP_PSM_UUID).then((r) => (suotaL2CapPsm = r))
            ]);
            this.fLog('suotaVersion', suotaVersion);
            this.fLog('suotaPatchDataSize', suotaPatchDataSize);
            this.fLog('suotaMtu', suotaMtu);
            this.fLog('suotaL2CapPsm', suotaL2CapPsm);
            suotaMtu = Math.min(suotaMtu, glasses.mtu, suotaPatchDataSize + 3);
            this.fLog('requesting Mtu', glasses.mtu, suotaPatchDataSize + 3, suotaMtu);
            await glasses.requestMtu(suotaPatchDataSize + 3).then((value) => {
                suotaMtu = value;
                DEV_LOG && console.log(TAG, 'requested suotaMtu', suotaMtu);
            });
            let value = (memoryType << 24) | (memoryBank & 0xff);
            this.fLog('writing SPOTA_MEM_DEV_UUID', value, 'waiting for status', 0x10);

            await writeValueForStatus(SPOTA_SERVICE_UUID, SPOTA_MEM_DEV_UUID, (memoryType << 24) | (memoryBank & 0xff), 0x10);

            const spiMISOAddress = 0x05;
            const spiMOSIAddress = 0x06;
            const spiCSAddress = 0x03;
            const spiSCKAddress = 0x00;
            // Step 2: Set memory params
            const memInfoData = (spiMISOAddress << 24) | (spiMOSIAddress << 16) | (spiCSAddress << 8) | spiSCKAddress;
            const toSend = getUint32(memInfoData);
            this.fLog('Set SPOTA_GPIO_MAP:', memInfoData);
            await bluetooth.write({ peripheralUUID: glasses.UUID, serviceUUID: SPOTA_SERVICE_UUID, characteristicUUID: SPOTA_GPIO_MAP_UUID, value: toSend });
            // Load patch data

            const chunkSize = Math.min(suotaPatchDataSize, suotaMtu - 3);
            this.fLog('chunkSize:', chunkSize);
            blockSize = Math.max(blockSize, chunkSize);
            this.fLog('blockSize:', blockSize);

            const suotaCharacteristic = new SuotaCharacteristic(glasses, SPOTA_SERVICE_UUID, SPOTA_PATCH_DATA_UUID);
            suotaCharacteristic.mtu = chunkSize;
            // Set patch length
            // const dv = new DataView(new ArrayBuffer(2));
            // dv.setUint16(0, blockSize, true);
            // console.log(TAG, 'writing firmware size', blockSize, dv);
            // buf.writeUInt32BE(data.byteLength, 0);
            await suotaCharacteristic.setBlockSize(blockSize).then(
                () =>
                    new Promise<void>((resolve, reject) => {
                        const data = theFile.readSync();
                        if (!data) {
                            return Promise.reject(`wrong firmwareFile: ${theFile.path}`);
                        }
                        let int8arr: Int8Array;
                        if (__IOS__) {
                            //@ts-ignore
                            int8arr = Int8Array.from(new Uint8Array(interop.bufferFromData(data)));
                            // int8arr.forEach((v, i, array)=>{
                            //     return array[i] = v - 256;
                            // })
                        } else {
                            int8arr = new Int8Array(data);
                        }

                        int8arr = appendChecksum(int8arr);
                        addStatusListener(suotaCharacteristic);
                        this.fLog('sending firmware data', int8arr.byteLength);

                        suotaCharacteristic.sendData(int8arr, (error, progress) => {
                            this.onFirmwareUpdateProgress(progress * 100);
                            if (error) {
                                removeStatusListener(suotaCharacteristic);
                                reject(error);
                            } else if (progress === 1) {
                                removeStatusListener(suotaCharacteristic);
                                resolve();
                            }
                        });
                    })
            );
            // Send SUOTA END command
            value = 0xfe000000;
            this.fLog('writing SPOTA_MEM_DEV_UUID (END command)', value, 'waiting for status', 0x02);
            await writeValueForStatus(SPOTA_SERVICE_UUID, SPOTA_MEM_DEV_UUID, 0xfe000000, 0x02);
            const result = await confirm({
                title: this.$tc('glasses_updated'),
                message: this.$tc('reboot_glasses'),
                okButtonText: this.$tc('reboot'),
                cancelButtonText: this.$tc('cancel')
            });
            DEV_LOG && console.log(TAG, 'glasses_updated, confirmed', result);
            if (result) {
                // Send reboot signal to device
                // ignore write errors. Apparently the glasses can reboot very quickly not letting the time for the write to response correctly
                return this.rebootGlasses();
            }
        } catch (err) {
            this.showError(err);
        } finally {
            this.currentProgress = 0;
            this.updatingFirmware = false;
        }
    }

    onFirmwareUpdateProgress(progress: number) {
        this.currentProgress = progress;
    }
}
