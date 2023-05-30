import fs from 'fs';
import path from 'path';
import cv2 from '@u4/opencv4nodejs';
import { CommandType, buildMessageData } from '../app/handlers/Message';
import { Encoder } from '@fsiot/heatshrink';
import { filesize } from 'filesize';
import { getAudioDurationInSeconds } from 'get-audio-duration';

function uint16ToByteArray(value) {
    const result = [];
    result.push((value & 0xff00) >> 8);
    result.push(value & 0xff);
    return result;
}
function uint32ToByteArray(value) {
    const result = [];
    result.push((value & 0xff000000) >> 24);
    result.push((value & 0xff0000) >> 16);
    result.push((value & 0xff00) >> 8);
    result.push(value & 0xff);
    return result;
}
export function pictureDimensionToByteArray(height, width) {
    const result = [];

    const size = (height * Math.ceil(width / 2) * 2) / 2;
    return uint32ToByteArray(size).concat(uint16ToByteArray(width));
    return result;
}
const { Readable } = require('stream');
import { Duplex } from 'stream';

export async function compressHs(buffer: Buffer) {
    return new Promise<Buffer>((resolve) => {
        const encoder = new Encoder({
            windowSize: 8,
            lookaheadSize: 4
        });
        const stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        stream.pipe(encoder);
        stream.on('end', () => {
            resolve(encoder.read());
        });
    });
}

export function compress4bpp(mat) {
    const imgHeight = mat.sizes[0];
    const imgWidth = mat.sizes[1];
    const encodedImg = [];
    // let val0;
    let byte = 0;
    let shift = 0;
    let pxl;
    for (let i = 0; i < imgHeight; i++) {
        byte = 0;
        shift = 0;
        for (let j = 0; j < imgWidth; j++) {
            // convert gray8bit to gray4bit
            pxl = Math.round(mat.at(i, j) / 17);

            // compress 4 bit per pixel
            byte += pxl << shift;
            shift += 4;
            if (shift === 8) {
                encodedImg.push(byte);
                byte = 0;
                shift = 0;
            }
        }
        if (shift !== 0) {
            encodedImg.push(byte);
        }
    }
    return encodedImg;
}

export async function createBitmapData({
    id,
    filePath,
    mat,
    crop = false,
    resize = true,
    compress = false,
    stream = false,
    chunkSize = 512,
    width = 244
}: {
    id: number;
    mat?;
    filePath?: string;
    crop?: boolean;
    compress?: boolean;
    stream?: boolean;
    resize?: boolean;
    chunkSize?: number;
    width?: number;
}): Promise<[number[][], number, number, number, number, number, number]> {
    // console.log('createBitmapData', id, filePath, mat, crop, resize, compress, stream, chunkSize, width);
    let gray = mat;
    if (!mat && filePath) {
        gray = cv2.imread(filePath);
        gray = gray.cvtColor(cv2.COLOR_BGR2GRAY);
    }
    let imgHeight = gray.sizes[0];
    let imgWidth = gray.sizes[1];
    const height = Math.round(width * 0.844);
    // console.log('createBitmapData', mat, imgWidth, imgHeight, resize);
    if (resize && imgWidth !== width) {
        //228/192
        gray = gray.resize(height, width, 1, 1, cv2.INTER_AREA);
        imgHeight = gray.sizes[0];
        imgWidth = gray.sizes[1];
    }
    const deltaX = Math.floor((244 - imgWidth) / 2);
    const deltaY = Math.floor((206 - imgHeight) / 2);
    let x = 0;
    let y = 0;
    gray = gray.rotate(cv2.ROTATE_180);
    if (crop) {
        const match = gray.findNonZero();
        let minx = imgWidth;
        let miny = imgHeight;
        let maxx = 0;
        let maxy = 0;
        match.forEach((point) => {
            if (point.x < minx) {
                minx = point.x;
            }
            if (point.x > maxx) {
                maxx = point.x;
            }
            if (point.y < miny) {
                miny = point.y;
            }
            if (point.y > maxy) {
                maxy = point.y;
            }
        });
        minx = Math.max(0, minx - 1);
        if (minx % 2 === 1) {
            minx -= 1;
        }
        miny = Math.max(0, miny - 1);
        if (miny % 2 === 1) {
            miny -= 1;
        }
        maxx = Math.max(0, maxx + 1);
        if (maxx % 2 === 1) {
            maxx += 1;
        }
        maxy = Math.max(0, maxy + 1);
        if (maxy % 2 === 1) {
            maxy += 1;
        }
        if (minx > 0 || miny > 0 || maxx < imgWidth || maxy < imgHeight) {
            gray = gray.getRegion(new cv2.Rect(minx, miny, maxx - minx, maxy - miny));
            const indexx = filePath.lastIndexOf('.');
            // const testPath = filePath.slice(0, indexx) + '_test' + filePath.slice(indexx);
            // cv2.imwrite(testPath, gray);
            x = minx;
            y = miny;
            // console.log(filePath, id, imgWidth, imgHeight, minx, miny, maxx, maxy, deltaX, deltaY, x, y);
            imgHeight = gray.sizes[0];
            imgWidth = gray.sizes[1];
        }
    }
    let commandToSend: Buffer | number[] = compress4bpp(gray);

    let compressed = false;

    let dataSize = commandToSend.length;
    if (compress) {
        // console.log('compressing', filePath, commandToSend.length);
        try {
            const compressedData = await compressHs(Uint8Array.from(commandToSend) as any);
            // console.log('compress done', filePath, compressedData.byteLength);
            if (compressedData.byteLength < dataSize) {
                // console.log('compressed', filePath, commandToSend.length, compressedData.byteLength, Math.round((1 - compressedData.byteLength / commandToSend.length) * 100) + '%');
                compressed = true;
                dataSize = compressedData.byteLength;
                commandToSend = [...Uint8Array.from(compressedData)];
            }
        } catch (error) {
            console.error('compressing error', error);
        }
    }
    const commandType = stream ? CommandType.StreamBmp : CommandType.SaveBmp;
    // console.log('commandToSend', filePath, inData.byteLength, commandToSend.length);
    const commandsToSend = [];
    if (stream) {
        commandsToSend.push(
            [0xff, commandType, 0x00, 0x10].concat(pictureDimensionToByteArray(imgHeight, imgWidth)).concat([...uint16ToByteArray(x), ...uint16ToByteArray(y), compressed ? 0x02 : 0x00, 0xaa])
        );
    } else {
        commandsToSend.push([0xff, commandType, 0x00, 0x0d, id].concat(pictureDimensionToByteArray(imgHeight, imgWidth)).concat([compressed ? 0x03 : 0x00, 0xaa]));
    }
    let temporary;
    const chunk = chunkSize;
    for (let i = 0, j = commandToSend.length; i < j; i += chunk) {
        temporary = commandToSend.slice(i, i + chunk);
        const dataLength = temporary.length;
        let framelength = dataLength + 5;
        let lenNbByte = 1;
        if (framelength > 0xff) {
            framelength += 1;
            lenNbByte = 2;
        }
        const header = lenNbByte === 2 ? [0xff, commandType, 0x10, ...uint16ToByteArray(framelength)] : [0xff, commandType, 0x00, framelength];
        commandsToSend.push(header.concat(temporary).concat([0xaa]));
    }
    return [commandsToSend, deltaX + x, deltaY + y, imgWidth, imgHeight, commandToSend.length, dataSize];
}

export function getAllFiles(dirPath, arrayOfFiles?) {
    // console.log('getAllFiles', dirPath);
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + '/' + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, '/', file));
        }
    });

    return arrayOfFiles;
}
export let imagesFolder;
export let navigationFolder;
export let storiesFolder;

export function setImageFolder(pathStr) {
    console.log('setImageFolder', pathStr);
    imagesFolder = pathStr;
    navigationFolder = path.join(imagesFolder, 'navigation');
    storiesFolder = path.join(imagesFolder, 'stories');
}
setImageFolder(path.resolve('../jules_verne/glasses_images'));

export function getFolder(configId: string) {
    console.log('getFolder', configId);
    if (configId === 'nav') {
        return navigationFolder;
    } else {
        return path.resolve(storiesFolder, configId);
    }
}

const nmReg = new RegExp('"nm":\\s*"(.*?)"', 'gm');
export async function buildDataSet(configId: string, crop = false, compress = false, width = 244) {
    const folder = getFolder(configId);
    // const filePath = path.resolve(path.join(__dirname, storyFolder));
    // const filePath = '/Volumes/data/mguillon/Downloads/Illustrations Flore';
    console.log('buildDataSet', configId, folder, crop, compress);
    const files: string[] = getAllFiles(folder)
        .filter((s) => s.endsWith('.jpg') || s.endsWith('.bmp') || s.endsWith('.png'))
        .filter((s) => s !== 'cover.png');
    // const files = ['/Volumes/dev/nativescript/jule_verne/jules_verne/glasses_images/navigation/right/30_pieds_droite_3.png'];
    const fileNames = files.map((s) => s.split('/').slice(-1)[0]);
    console.log('files', files.length);

    const compositionPath = path.join(folder, 'composition.json');
    if (fs.existsSync(compositionPath)) {
        const nms = [
            ...new Set(
                [...fs.readFileSync(path.join(folder, 'composition.json'), 'utf-8').matchAll(nmReg)]
                    ?.map((p) => p[1].split('.')[0])
                    .slice(1)
                    .sort()
            )
        ];
        // console.log('nms', nms.length, nms);
        nms.forEach((nm) => {
            if (fileNames.indexOf(nm + '.png') === -1 && fileNames.indexOf(nm + '.jpg') === -1) {
                console.error('composition error:', 'file missing:', nm);
            }
        });
        fileNames.forEach((file) => {
            if (nms.indexOf(file.split('.')[0]) === -1) {
                //remove it from files
                const index = files.findIndex((s) => s.endsWith(file));
                console.error('image not used:', file, index);
                if (index !== -1) {
                    files.splice(index, 1);
                }
            }
        });
    }

    const jsonOrderData = {};
    const data: number[][] = [];
    data.push([
        ...Uint8Array.from(
            buildMessageData(CommandType.cfgWrite, {
                params: {
                    name: configId,
                    password: 0,
                    version: 2
                }
            })
        )
    ]);
    data.push([
        ...Uint8Array.from(
            buildMessageData(CommandType.EraseBmp, {
                params: [0xff]
            })
        )
    ]);
    let imgIndex = 0;
    let totalImageSize = 0;
    for (let index = 0; index < files.length; index++) {
        const item = files[index];
        const key = item.split('/').slice(-1)[0].split('.')[0];
        if (!jsonOrderData[key]) {
            const relative = path.relative(folder, path.dirname(item));
            const [imgData, x, y, w, h, size] = await createBitmapData({ id: imgIndex, filePath: item, crop, compress, width });
            totalImageSize += size;
            if (configId === 'nav') {
                jsonOrderData[key] = [imgIndex, x, y, w, h, relative];
            } else {
                jsonOrderData[key] = [imgIndex, x, y, w, h];
            }
            data.push(...imgData);
            imgIndex++;
        }
    }
    // console.log('jsonOrderData', Object.keys(jsonOrderData).length, jsonOrderData);
    fs.writeFileSync(
        path.join(folder, 'info.json'),
        JSON.stringify({
            totalImageSize,
            compress,
            crop
        })
    );
    fs.writeFileSync(path.join(folder, 'image_map.json'), JSON.stringify(jsonOrderData));
    // const data = files.reduce((accumulator, currentValue) => accumulator.concat(createBitmapData(currentValue)), [] as number[][]);
    console.log('data', filesize(totalImageSize));

    const fileDataStr = data.reduce(
        (accumulator, currentValue) =>
            accumulator +
            Array.from(currentValue, (byte) => ('0' + (byte & 0xff).toString(16)).slice(-2))
                .join('')
                .toUpperCase() +
            '\n',
        ''
    );

    if (fs.existsSync(path.join(folder, 'audio.mp3'))) {
        const audioDuration = Math.round((await getAudioDurationInSeconds(path.join(folder, 'audio.mp3'))) * 1000);
        const metadataPath = path.join(folder, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify({ ...JSON.parse(fs.readFileSync(metadataPath, 'utf-8')), audioDuration }));
    }

    // const fileDataStr = data.reduce((accumulator, currentValue) => accumulator + '0x' + Array.from(currentValue, (byte) => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('') + '\n', '');

    fs.writeFileSync(path.join(folder, 'images.txt'), fileDataStr);
    return { data, files };
}
