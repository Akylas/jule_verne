import fs from 'fs';
import path from 'path';
import cv2 from '@u4/opencv4nodejs';
import { CommandType, buildMessageData } from '../app/handlers/Message';
export function pictureDimensionToByteArray(height, width) {
    const result = [];

    const size = (height * Math.ceil(width / 2) * 2) / 2;

    result.push((size & 0xff000000) >> 24);
    result.push((size & 0xff0000) >> 16);
    result.push((size & 0xff00) >> 8);
    result.push(size & 0xff);

    result.push((width & 0xff00) >> 8);
    result.push(width & 0xff);
    return result;
}

export function createBitmapData(id: number, filePath: string, crop = false): [number[][], number, number, number, number, number] {
    let gray = cv2.imread(filePath).cvtColor(cv2.COLOR_BGR2GRAY);
    let imgHeight = gray.sizes[0];
    let imgWidth = gray.sizes[1];
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
        miny = Math.max(0, miny - 1);
        maxx = Math.max(0, maxx + 1);
        maxy = Math.max(0, maxy + 1);
        console.log(filePath, minx, miny, maxx, maxy);
        if (minx > 0 || miny > 0 || maxx < imgWidth || maxy < imgHeight) {
            gray = gray.getRegion(new cv2.Rect(minx, miny, maxx - minx, maxy - miny));
            gray = gray.rotate(cv2.ROTATE_180);
            imgHeight = gray.sizes[0];
            imgWidth = gray.sizes[1];
        } else {
            gray = gray.rotate(cv2.ROTATE_180);
        }
    } else {
        gray = gray.rotate(cv2.ROTATE_180);
    }
    // let match = gray.findNonZero();
    // let minx = imgWidth;
    // let miny = imgHeight;
    // let maxx = 0;
    // let maxy = 0;
    // match.forEach((point) => {
    //     if (point.x < minx) {
    //         minx = point.x;
    //     }
    //     if (point.x > maxx) {
    //         maxx = point.x;
    //     }
    //     if (point.y < miny) {
    //         miny = point.y;
    //     }
    //     if (point.y > maxy) {
    //         maxy = point.y;
    //     }
    // });
    // minx = Math.max(0, minx - 1);
    // miny = Math.max(0, miny - 1);
    // maxx = Math.max(0, maxx + 1);
    // maxy = Math.max(0, maxy + 1);
    // console.log(filePath, minx, miny, maxx, maxy);
    // if (minx > 0 || miny > 0 || maxx < imgWidth || maxy < imgHeight) {
    //     gray = gray.getRegion(new cv2.Rect(minx, miny, maxx - minx, maxy - miny));
    //     gray = gray.rotate(cv2.ROTATE_180);
    //     imgHeight = gray.sizes[0];
    //     imgWidth = gray.sizes[1];
    // } else {
    // gray = gray.rotate(cv2.ROTATE_180);
    // }
    // let cptImg = 0;
    const commandsToSend = [[0xff, CommandType.SaveBmp, 0x00, 0x0c, id].concat(pictureDimensionToByteArray(imgHeight, imgWidth)).concat([0xaa])];
    const commandToSend = [];
    // let val0;
    let byte = 0;
    let shift = 0;
    let pxl;
    for (let i = 0; i < imgHeight; i++) {
        byte = 0;
        shift = 0;
        for (let j = 0; j < imgWidth; j++) {
            // convert gray8bit to gray4bit
            pxl = Math.round(gray.at(i, j) / 17);

            // compress 4 bit per pixel
            byte += pxl << shift;
            shift += 4;
            if (shift === 8) {
                commandToSend.push(byte);
                byte = 0;
                shift = 0;
            }
        }
        if (shift !== 0) {
            commandToSend.push(byte);
        }
    }

    let temporary;
    const chunk = 250;
    for (let i = 0, j = commandToSend.length; i < j; i += chunk) {
        temporary = commandToSend.slice(i, i + chunk);
        commandsToSend.push([0xff, CommandType.SaveBmp, 0x00, temporary.length + 5].concat(temporary).concat([0xaa]));
    }
    // return [commandsToSend, minx, miny, imgWidth, imgHeight];
    return [commandsToSend, 0, 0, imgWidth, imgHeight, (imgHeight * Math.ceil(imgWidth / 2) * 2) / 2];
}

export function getAllFiles(dirPath, arrayOfFiles?) {
    console.log('getAllFiles', dirPath);
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
export const imagesFolder = path.resolve('../jules_verne/glasses_images');
export const navigationFolder = path.join(imagesFolder, 'navigation');
export const storiesFolder = path.join(imagesFolder, 'stories');

export function getFolder(configId: string) {
    if (configId === 'nav') {
        return navigationFolder;
    } else {
        return path.resolve(storiesFolder, configId);
    }
}

const nmReg = new RegExp('"nm":\\s*"(.*?)"', 'gm');
export function buildDataSet(configId: string, crop = false) {
    const folder = getFolder(configId);
    // const filePath = path.resolve(path.join(__dirname, storyFolder));
    // const filePath = '/Volumes/data/mguillon/Downloads/Illustrations Flore';
    console.log('buildDataSet', configId, folder);
    const files = getAllFiles(folder).filter((s) => s.endsWith('.jpg') || s.endsWith('.bmp') || s.endsWith('.png'));
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
        console.log('nms', nms.length, nms);
        nms.forEach((nm) => {
            if (fileNames.indexOf(nm + '.png') === -1) {
                console.error('composition error:', 'file missing:', nm);
            }
        });
        fileNames.forEach((file) => {
            if (nms.indexOf(file.split('.')[0]) === -1) {
                console.error('image not used:', file);
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
        const key = item.split('/').slice(-1)[0].split('.')[0].replace(/\s/g, '-');
        if (!jsonOrderData[key]) {
            const [imgData, x, y, width, height, size] = createBitmapData(imgIndex, item, crop);
            totalImageSize += size;
            jsonOrderData[key] = [imgIndex, x, y, width, height];
            data.push(...imgData);
            imgIndex++;
        }
    }
    console.log('jsonOrderData', jsonOrderData);
    fs.writeFileSync(
        path.join(folder, 'info.json'),
        JSON.stringify({
            totalImageSize
        })
    );
    fs.writeFileSync(path.join(folder, 'image_map.json'), JSON.stringify(jsonOrderData));
    // const data = files.reduce((accumulator, currentValue) => accumulator.concat(createBitmapData(currentValue)), [] as number[][]);
    console.log('data', totalImageSize);

    const fileDataStr = data.reduce((accumulator, currentValue) => accumulator + '0x' + currentValue.map((d) => d.toString(16).padStart(2, '0')).join('') + '\n', '');
    // fs.writeFileSync(path.join(folder, 'images.bin'), new Uint8Array(data.flat()));
    fs.writeFileSync(path.join(folder, 'images.txt'), fileDataStr);
    return { data, files };
}
