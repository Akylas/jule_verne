import { GlassesSettings } from './BluetoothHandler';

export const HEADER = 0xff;
export const FOOTER = 0xaa;

export const CONFIG_NAME = 'julesverne';
export const CONFIG_VERSION = 1;
export const CONFIG_PASSWORD = 'julesverne';
export const FULLSCREEN = [0, 0, 303, 255];

export function numberToUint16Array(n: number) {
    return [(n >> 8) & 0xff, n & 0xff];
}
export function numberToUint32Array(f) {
    return Array.from(new Uint8Array(Float32Array.of(f).buffer));
}

function concatTypedArrays(a, b) {
    // Checks for truthy values on both arrays
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

export function intFromBytes(x) {
    let val = 0;
    const length = x.length;
    for (let i = 0; i < length; ++i) {
        val += x[i];
        if (i < length - 1) {
            val = val << 8;
        }
    }
    return val;
}
export function toUTF8Array(str: string, maxLengthForCtrlChar: number = Number.MAX_SAFE_INTEGER) {
    const utf8 = [];
    if (!str) {
        return;
    }
    str = str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    for (let i = 0; i < str.length; i++) {
        const charcode = str.charCodeAt(i);
        if (charcode < 0xff) {
            utf8.push(charcode);
        }
    }
    if (utf8.length < maxLengthForCtrlChar) {
        utf8.push(0);
    }
    return utf8;
}

export function fromUTF8Array(data: MessageBuffer) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data[i]);
    }
    return result;
}

export interface WriteConfigParams {
    name: string;
    version: number;
    password: number;
}

export interface ParamsTypeMap {
    [CommandType.cfgWrite]: WriteConfigParams;
    [CommandType.cfgSet]: { name: string };
    [CommandType.cfgDelete]: { name: string };
    [CommandType.SetBLEConnectParam]: { intervalMinMs: number; intervalMaxMs: number; slaveLatency: number; supTimeoutMs: number };
}
type TypedParamCommands = keyof ParamsTypeMap;
export type ConfigListData = {
    name: string;
    size: number;
    version: number;
}[];
export interface FreeSpaceData {
    totalSize: number;
    freeSpace: number;
}
export interface OutputTypeMap {
    [CommandType.Settings]: GlassesSettings;
    [CommandType.cfgFreeSpace]: FreeSpaceData;
    [CommandType.cfgList]: ConfigListData;
}
type TypedOutputCommands = keyof OutputTypeMap;

export type OutputMessageType<T extends CommandType> = T extends CommandType.cfgFreeSpace | CommandType.cfgList | CommandType.Settings ? OutputTypeMap[T] : any;
export type InputCommandType<T extends CommandType> = T extends CommandType.SetBLEConnectParam | CommandType.cfgWrite | CommandType.cfgDelete | CommandType.cfgSet
    ? ParamsTypeMap[T]
    : (string | number | number[] | Uint8Array)[];
export enum CommandType {
    Any = -1,
    Power = 0x00,
    Clear = 0x01,
    Grey = 0x02,
    Demo = 0x03,
    Test = 0x04,
    Battery = 0x05,
    Version = 0x06,
    Debug = 0x07,
    Led = 0x08,
    Shift = 0x09,
    Settings = 0x0a,
    SetName = 0x0b,
    Luma = 0x10,
    Dim = 0x11,
    LumaMode = 0x12,
    Sensor = 0x20,
    Gesture = 0x21,
    Als = 0x22,
    Color = 0x30,
    Point = 0x31,
    Line = 0x32,
    Rect = 0x33,
    Rectf = 0x34,
    Circ = 0x35,
    Circf = 0x36,
    Txt = 0x37,
    HoldFlushw = 0x39,
    BmpList = 0x40,
    SaveBmp = 0x41,
    imgDisplay = 0x42,
    EraseBmp = 0x43,
    DeleteBmp = 0x46,
    FontList = 0x50,
    SaveFont = 0x51,
    Font = 0x52,
    EraseFont = 0x53,
    SaveLayout = 0x60,
    EraseLayout = 0x61,
    Layout = 0x62,
    ClearLayout = 0x63,
    LayoutList = 0x64,
    Gauge = 0x70,
    SaveGauge = 0x71,
    WPage = 0x80,
    RPage = 0x81,
    EnPage = 0x82,
    ReadMdpProm = 0x90,
    WriteMdpProm = 0x91,
    ReadMdpData = 0x92,
    Setece = 0xa0,
    SetBLEConnectParam = 0xa4,
    TDBG = 0xb0,
    cfgWrite = 0xd0,
    cfgRead = 0xd1,
    cfgSet = 0xd2,
    cfgList = 0xd3,
    cfgRename = 0xd4,
    cfgDelete = 0xd5,
    cfgDeleteLessUsed = 0xd6,
    cfgFreeSpace = 0xd7,
    cfgGetNb = 0xd8,
    NbConfigs = 0xd8,
    Error = 0xe2,
    RawCommand = 0xefefef // only used in app to say we want to send raw data
}

function byteArrayToNumber(byteArray) {
    let value = 0;
    for (let i = 0; i < byteArray.length; i++) {
        value = value * 256 + byteArray[i];
    }

    return value;
}

function numberToByteArray(nb, bytesCount) {
    // we want to represent the input as a 8-bytes array
    const byteArray = [];
    byteArray.length = bytesCount;
    byteArray.fill(0);

    for (let index = 0; index < byteArray.length; index++) {
        const byte = nb & 0xff;
        byteArray[index] = byte;
        nb = (nb - byte) / 256;
    }

    return byteArray;
}

export enum ParsingState {
    Waiting,
    ParsingCommandType,
    ParsingControlFlag,
    ParsingQueryId,
    ParsingTotalMessageLength,
    ParsingPayload,
    ParsingEndFlag
}

export interface Message<T extends CommandType> {
    commandType: T;
    queryId?: number;
    data?: OutputMessageType<T>;
    rawData?: any;
    receivedTimestamp?: number;
    [k: string]: any;
}

export interface ParseResult<T extends CommandType = any> {
    commandType?: T;
    queryId?: number;
    message?: Message<T>;
    state: ParsingState;
    progressData?: ProgressData;
}

export interface ProgressData {
    queryId?: number;
    sent?: number;
    received?: number;
    total?: number;
}

function parseMessagePayload(commandType: CommandType, data: Uint8Array) {
    switch (commandType) {
        case CommandType.cfgRead:
            // 8bytes
            return {
                version: data ? intFromBytes(data.slice(1, 5)) : -1
            };
        case CommandType.Version:
            return {
                version: `${data[0]}.${data[1]}.${data[2]}${String.fromCharCode(data[3])}`
            };
        case CommandType.cfgFreeSpace:
            return {
                totalSize: intFromBytes(data.slice(0, 4)),
                freeSpace: intFromBytes(data.slice(4, 8))
            };
        case CommandType.cfgList:
            let remainingLength = data.byteLength;
            let currentSlice = data.slice(0);
            const configs = [];
            while (remainingLength > 0) {
                let endNameIndex = currentSlice.indexOf(0);
                let removeCtrlChar = true;
                if (endNameIndex > 11) {
                    endNameIndex = 11;
                    removeCtrlChar = false;
                }
                const dataView = new DataView(new Uint8Array(currentSlice).buffer);
                const name = fromUTF8Array(currentSlice.slice(0, endNameIndex));
                if (removeCtrlChar) {
                    endNameIndex += 1;
                }
                remainingLength -= endNameIndex + 11;
                configs.push({
                    name,
                    size: dataView.getUint32(endNameIndex, false),
                    version: dataView.getUint32(endNameIndex + 4, false),
                    usgCnt: currentSlice[endNameIndex + 8],
                    installCnt: currentSlice[endNameIndex + 9],
                    isSystem: currentSlice[endNameIndex + 10] === 1 ? true : false
                });
                currentSlice = currentSlice.slice(endNameIndex + 11);
            }
            // for (let index = 0; index < nbConfig; index++) {
            //     const sliceData = data.slice(23 * index, 23 * (index + 1));
            //     const dataView = new DataView(sliceData.buffer);
            //     configs.push({
            //         name: fromUTF8Array(sliceData.slice(0, 12)),
            //         size: dataView.getUint32(12),
            //         version: dataView.getUint32(16),
            //         usgCnt: sliceData[20],
            //         installCnt: sliceData[21],
            //         isSystem: sliceData[22] === 1 ? true : false
            //     });
            // }
            return configs;
        case CommandType.NbConfigs:
            return data[0];
        case CommandType.Settings:
            const mask0 = data[0] >> 7; // gets the 6th bit
            const mask1 = data[1] >> 7; // gets the 6th bit
            return {
                shift: {
                    x: mask0 ? data[0] - 256 : data[0],
                    y: mask1 ? data[1] - 256 : data[1]
                },
                luma: data[2],
                als: !!data[3],
                gesture: !!data[4]
            } as GlassesSettings;
        case CommandType.Error:
            return {
                cmdId: data[0],
                error: data[1],
                subError: data[2]
            };
        default:
            return undefined;
    }
}

export type ByteArray = number[];
export type MessageBuffer = ByteArray | Uint8Array;
export class MessageParser {
    currentPayload?: Uint8Array;
    private currentMessageType: CommandType;
    currentQueryId: number;
    currentControlFlag: number;
    currentResponseType: CommandType;
    currentDataType: number;
    currentDataLength: number;
    currentQueryIdLength: number;
    private currentPayloadLength: number;
    private currentReceivedPayloadLength: number;
    private currentTotalMessageLengthArray: ByteArray;
    private currentQueryIdArray: ByteArray;
    parsingState = ParsingState.Waiting;
    constructor(onMessage?: <T extends CommandType = CommandType.Any>(btmessage: Message<T>) => {}) {
        if (onMessage) {
            this.onMessage = onMessage;
        }
        this.reset();
    }
    isReceiving() {
        return this.parsingState !== ParsingState.Waiting;
    }
    onMessage<T extends CommandType = CommandType.Any>(btmessage: Message<T>) {}
    reset() {
        this.setParsingState(ParsingState.Waiting);
        this.currentPayload = undefined;
        this.currentResponseType = -1;
        this.currentDataType = -1;
        this.currentReceivedPayloadLength = 0;
        this.currentPayloadLength = 0;
        this.currentMessageType = undefined;
    }
    private setParsingState(state) {
        this.parsingState = state;
    }
    cancel() {
        if (this.currentQueryId) {
            // we have a running queryId, let's throw an error
            // return Message.fromType(ReturnType.OnError, this.currentQueryId);
        }
        this.reset();
    }
    parserQueue: (() => void)[] = [];
    internalParseData(data: MessageBuffer, callback: (results: ParseResult[]) => void) {
        const dataLength = data.length;
        const results: ParseResult[] = [];
        let i,
            start = 0,
            value;
        let result: ParseResult = {
            state: this.parsingState,
            commandType: this.currentMessageType,
            queryId: this.currentQueryId
        };

        const handleMessage = () => {
            // console.log('internalParseData', data, dataLength, this.currentQueryId);
            result.state = this.parsingState;
            result.message = Object.assign({
                commandType: this.currentMessageType,
                queryId: this.currentQueryId,
                data: parseMessagePayload(this.currentMessageType, this.currentPayload),
                rawData: this.currentPayload,
                receivedTimestamp: Date.now()
            });
            result.progressData = {
                queryId: this.currentQueryId,
                total: this.currentReceivedPayloadLength,
                received: this.currentReceivedPayloadLength
            };
            results.push(result);
            if (result.message) {
                this.onMessage(result.message);
            }
            this.reset();
            result = {
                state: this.parsingState,
                commandType: this.currentMessageType,
                queryId: this.currentQueryId
            };
        };

        if (this.parsingState === ParsingState.ParsingPayload) {
            let toAppend;
            if (this.currentReceivedPayloadLength + dataLength <= this.currentPayloadLength) {
                toAppend = data;
                start = dataLength;
                results.push(result);
            } else {
                const diff = this.currentPayloadLength - this.currentReceivedPayloadLength;
                start = diff;
                toAppend = data.slice(0, diff);
                this.setParsingState(ParsingState.ParsingEndFlag);
            }
            if (toAppend) {
                if (!(toAppend instanceof Uint8Array)) {
                    toAppend = Uint8Array.from(toAppend);
                }
                if (this.currentPayload) {
                    this.currentPayload = concatBuffers(this.currentPayload, toAppend);
                } else {
                    this.currentPayload = Uint8Array.from(toAppend);
                }
                this.currentReceivedPayloadLength += toAppend.length;
                result.progressData = {
                    queryId: this.currentQueryId,
                    received: this.currentReceivedPayloadLength,
                    total: this.currentPayloadLength
                };
            }
        }
        for (i = start; i < dataLength; ++i) {
            value = data[i];
            switch (this.parsingState) {
                case ParsingState.Waiting:
                    if (value === HEADER) {
                        this.setParsingState(ParsingState.ParsingCommandType);
                    }
                    break;
                case ParsingState.ParsingCommandType:
                    this.currentMessageType = result.commandType = value;
                    this.setParsingState(ParsingState.ParsingControlFlag);
                    break;
                case ParsingState.ParsingControlFlag:
                    this.currentControlFlag = value;
                    this.currentDataLength = ((value >> 8) & 0xff) + 1;
                    this.currentQueryIdLength = value & 0xff;

                    this.currentTotalMessageLengthArray = [];
                    this.setParsingState(ParsingState.ParsingTotalMessageLength);
                    break;
                case ParsingState.ParsingTotalMessageLength:
                    this.currentTotalMessageLengthArray.push(value);
                    if (this.currentTotalMessageLengthArray.length === this.currentDataLength) {
                        const totalLength = byteArrayToNumber(this.currentTotalMessageLengthArray);
                        this.currentPayloadLength = totalLength - this.currentQueryIdLength - this.currentDataLength - 4; // HEADER+COMMANDTYPE+CONTROLFLAG+FOOTER
                        if (this.currentQueryIdLength > 0) {
                            this.currentQueryIdArray = [];
                            this.setParsingState(ParsingState.ParsingQueryId);
                        } else if (this.currentPayloadLength > 0) {
                            this.setParsingState(ParsingState.ParsingPayload);
                        } else {
                            this.setParsingState(ParsingState.ParsingEndFlag);
                        }
                    }
                    break;
                // 255,10,0,10,0,0,8,1,0,170
                // 255,10,0,10,5,8,8,0,0,170
                case ParsingState.ParsingQueryId:
                    this.currentQueryIdArray.push(value);
                    if (this.currentQueryIdArray.length === this.currentQueryIdLength) {
                        this.currentQueryId = result.queryId = byteArrayToNumber(this.currentQueryIdArray);
                        if (this.currentPayloadLength > 0) {
                            this.setParsingState(ParsingState.ParsingPayload);
                        } else {
                            this.setParsingState(ParsingState.ParsingEndFlag);
                        }
                    }
                    break;

                case ParsingState.ParsingPayload:
                    const diff = this.currentPayloadLength - (dataLength - i);
                    const onlyPayload = diff >= 0;
                    let theRest;
                    if (onlyPayload) {
                        theRest = data.slice(i);
                        i = dataLength; // stop for loop
                    } else {
                        theRest = data.slice(i, i + this.currentPayloadLength);
                        i += this.currentPayloadLength - 1;
                        this.setParsingState(ParsingState.ParsingEndFlag);
                    }
                    this.currentReceivedPayloadLength = theRest.length;
                    result.progressData = {
                        queryId: this.currentQueryId,
                        received: this.currentReceivedPayloadLength,
                        total: this.currentPayloadLength
                    };
                    this.currentPayload = theRest instanceof Uint8Array ? theRest : Uint8Array.from(theRest);
                    break;
                case ParsingState.ParsingEndFlag:
                    if (value === FOOTER) {
                        handleMessage();
                    }
                    break;
            }
        }
        this.parserQueue.shift();
        callback && callback(results);
        if (this.parserQueue.length > 0) {
            this.parserQueue[0]();
        }
    }
    parseData(data: MessageBuffer, callback?: (results: ParseResult[]) => void) {
        if (this.parserQueue.length > 0) {
            const newData = data;
            const newCallback = callback;
            this.parserQueue.push(() => {
                this.internalParseData(newData, newCallback);
            });
            return;
        }
        this.parserQueue.push(() => {});
        this.internalParseData(data, callback);
    }
}

// type MessageParams<T extends CommandType> = ParamsTypeMap[T];
function getTypeParam<T extends CommandType>(commandType: T, param: any) {
    return param as InputCommandType<T>;
}
export function buildMessageData<T extends CommandType>(
    commandType: T,
    options: {
        timestamp?: number;
        params?: InputCommandType<T>;
    } = {}
) {
    // DEV_LOG && console.log('buildMessageData', CommandType[commandType], options);
    if (commandType === CommandType.RawCommand) {
        return options.params[0];
    }
    const queryIdLength = options.timestamp ? 8 : 0;
    let messageLength =
        1 + // header
        1 + // command Id
        1 + // format command
        1 + // data length, will be incremented if necessary
        queryIdLength + // query id length
        1; // footer
    let data;
    switch (commandType) {
        case CommandType.Layout:
            data = [options.params[0]].concat(toUTF8Array(options.params[1]));
            break;
        case CommandType.Power:
        case CommandType.Als:
        case CommandType.Gesture:
            data = options.params[0] === 'on' ? [1] : [0];
            break;
        case CommandType.imgDisplay:
            data = [options.params[0]].concat(numberToUint16Array(options.params[1])).concat(numberToUint16Array(options.params[2]));
            break;
        case CommandType.SetName:
            data = toUTF8Array(options.params[0]);
            break;
        case CommandType.Shift:
        case CommandType.Rectf:
        case CommandType.Rect:
            const params = getTypeParam(CommandType.Rectf, options.params);
            data = params.map(numberToUint16Array).flat();
            // data = numberToUint16Array(options.params[0]).concat(numberToUint16Array(options.params[1])).concat(numberToUint16Array(options.params[2])).concat(numberToUint16Array(options.params[3]));
            break;
        case CommandType.cfgWrite: {
            const params = getTypeParam(CommandType.cfgWrite, options.params);
            data = [...toUTF8Array(params.name, 12), ...numberToUint32Array(params.version), ...numberToUint32Array(params.password)];
            break;
        }
        case CommandType.cfgDelete:
        case CommandType.cfgSet: {
            const params = getTypeParam(CommandType.cfgSet, options.params);
            data = toUTF8Array(params.name, 12);
            break;
        }
        case CommandType.Txt:
            data = numberToUint16Array(options.params[0])
                .concat(numberToUint16Array(options.params[1]))
                .concat([options.params[2], options.params[3], options.params[4]])
                .concat(toUTF8Array(options.params[5]));
            break;
        case CommandType.SetBLEConnectParam: {
            const params = getTypeParam(CommandType.SetBLEConnectParam, options.params);
            data = numberToUint16Array(Math.round((params.intervalMinMs * 100) / 125))
                .concat(numberToUint16Array(Math.round((params.intervalMaxMs * 100) / 125)))
                .concat(numberToUint16Array(params.slaveLatency))
                .concat(numberToUint16Array(Math.round(params.supTimeoutMs / 10)));
            break;
        }
        default:
            data = options.params;
            break;
    }

    messageLength += data ? data.length : 0;
    const hasLongData = messageLength > 255;
    if (hasLongData) {
        messageLength += 1;
    }
    const messageData = new Uint8Array(messageLength);
    let index = 0;
    messageData[index++] = HEADER;
    messageData[index++] = commandType;
    if (hasLongData) {
        messageData[index++] = 0x10 + queryIdLength;
        const bb = numberToUint16Array(messageLength);
        messageData[index++] = bb[0];
        messageData[index++] = bb[1];
    } else {
        messageData[index++] = 0x00 + queryIdLength;
        messageData[index++] = messageLength;
    }
    if (queryIdLength > 0) {
        const queryData = numberToByteArray(options.timestamp, queryIdLength);
        for (let i = queryData.length - 1; i >= 0; i--) {
            messageData[index++] = queryData[i];
        }
    }

    if (data) {
        for (let i = 0; i < data.length; i++) {
            messageData[index++] = data[i];
        }
        // index += data.length;
    }
    messageData[index++] = FOOTER;

    return messageData;
}
