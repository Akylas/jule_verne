export const HEADER = 0xff;
export const FOOTER = 0xaa;

export function numberToUint8Array(n: number) {
    return [(n >> 8) & 0xff, n & 0xff];
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
export function toUTF8Array(str: string) {
    str = str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
        const charcode = str.charCodeAt(i);
        if (charcode < 0xff) {
            utf8.push(charcode);
        }
        // else if (charcode < 0xd800 || charcode >= 0xe000) {
        //     utf8.push(0xe0 | (charcode >> 12),
        //               0x80 | ((charcode>>6) & 0x3f),
        //               0x80 | (charcode & 0x3f));
        // }
        // surrogate pair
        // else {
        // i++;
        // we ignore utf16
        // // UTF-16 encodes 0x10000-0x10FFFF by
        // // subtracting 0x10000 and splitting the
        // // 20 bits of 0x0-0xFFFFF into two halves
        // charcode = 0x10000 + (((charcode & 0x3ff)<<10)
        //           | (str.charCodeAt(i) & 0x3ff))
        // utf8.push(0xf0 | (charcode >>18),
        //           0x80 | ((charcode>>12) & 0x3f),
        //           0x80 | ((charcode>>6) & 0x3f),
        //           0x80 | (charcode & 0x3f));
        // }
    }
    utf8.push(0);
    return utf8;
}

export function fromUTF8Array(data: MessageBuffer) {
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(data[i]);
    }
    return result;
}

export enum CommandType {
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
    BmpList = 0x40,
    SaveBmp = 0x41,
    Bitmap = 0x42,
    EraseBmp = 0x43,
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
    TDBG = 0xb0,
    Wconfig = 0xa1,
    Rconfig = 0xa2,
    Setconfig = 0xa3,
    Memory = 0xd7,
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

export interface Message {
    commandType: CommandType;
    queryId?: number;
    data?: any;
    rawData?: any;
    receivedTimestamp?: number;
    [k: string]: any;
}

export interface ParseResult {
    commandType?: CommandType;
    queryId?: number;
    message?: Message;
    state: ParsingState;
    progressData?: ProgressData;
}

export interface ProgressData {
    queryId?: number;
    sent?: number;
    received?: number;
    total?: number;
}

function parseMessagePayload(commandType: CommandType, data: Buffer) {
    // console.log('parseMessagePayload', commandType, data);
    switch (commandType) {
        case CommandType.Rconfig:
            // 8bytes
            return {
                version: data ? intFromBytes(data.slice(1, 5)) : -1
            };
        case CommandType.Version:
            return {
                version: `${data[0]}.${data[1]}.${data[2]}${String.fromCharCode(data[3])}`
            };
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
            };
            break;

        default:
            return undefined;
            break;
    }
}

export type ByteArray = number[];
export type MessageBuffer = ByteArray | Uint8Array;
export class MessageParser {
    currentPayload?: Buffer;
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
    constructor(onMessage?: (btmessage: Message) => {}) {
        if (onMessage) {
            this.onMessage = onMessage;
        }
        this.reset();
    }
    isReceiving() {
        return this.parsingState !== ParsingState.Waiting;
    }
    onMessage(btmessage: Message) {}
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
                if (!(toAppend instanceof Buffer)) {
                    toAppend = Buffer.from(toAppend);
                }
                if (this.currentPayload) {
                    this.currentPayload = Buffer.concat([this.currentPayload, toAppend]);
                } else {
                    this.currentPayload = Buffer.from(toAppend);
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
                    this.currentPayload = theRest instanceof Buffer ? theRest : Buffer.from(theRest);
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

export function buildMessageData(
    commandType: CommandType,
    options: {
        timestamp?: number;
        params?: any[];
    } = {}
) {
    if (commandType === CommandType.RawCommand) {
        return Buffer.from(options.params[0]);
    }
    // console.log('sendBinaryCommand', commandType, options);
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
            break;
        case CommandType.Bitmap:
            data = [options.params[0]].concat(numberToUint8Array(options.params[1])).concat(numberToUint8Array(options.params[2]));
            break;
        case CommandType.SetName:
            data = toUTF8Array(options.params[0]);
            break;
        case CommandType.Shift:
            data = numberToUint8Array(options.params[0]).concat(numberToUint8Array(options.params[1]));
            break;
        case CommandType.Rectf:
            data = numberToUint8Array(options.params[0]).concat(numberToUint8Array(options.params[1])).concat(numberToUint8Array(options.params[2])).concat(numberToUint8Array(options.params[3]));
            break;
        case CommandType.Wconfig:
            const configId = options.params[0];
            data = [configId, 0, 0, 0, 1].concat(options.params[1], options.params[2], options.params[3]);
            break;
        case CommandType.Txt:
            data = numberToUint8Array(options.params[0])
                .concat(numberToUint8Array(options.params[1]))
                .concat([options.params[2], options.params[3], options.params[4]])
                .concat(toUTF8Array(options.params[5]));
            break;
        default:
            data = options.params;
            break;
    }

    messageLength += data ? data.length : 0;
    const hasLongData = messageLength > 255;
    if (hasLongData) {
        messageLength += 1;
    }
    const messageData = Buffer.alloc(messageLength);
    let index = 0;
    messageData[index++] = HEADER;
    messageData[index++] = commandType;
    if (hasLongData) {
        messageData[index++] = 0x10 + queryIdLength;
        const bb = numberToUint8Array(messageLength);
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
