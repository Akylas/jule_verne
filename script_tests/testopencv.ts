import path from 'path';
import { program } from '@caporal/core';
import { readFileSync, writeFileSync } from 'fs';
import cv2 from '@u4/opencv4nodejs';
import { createBitmapData } from './common';

program.option('--path [path]', 'filePath', { default: '/Volumes/data/mguillon/Desktop/aristideadulte1.jpg' }).action(async ({ logger, args, options }) => {
    const interpolation = cv2.INTER_LINEAR;
    const mat = cv2
        .imread(options.path + '')
        .cvtColor(cv2.COLOR_BGR2GRAY)
        .resize(206, 244, 1, 1, interpolation);

    const [imgData, x, y, width, height, size, dataSize] = await createBitmapData({ id: 0, mat, crop: true, compress: true });
    cv2.imwrite((options.path + '').split('.').slice(0, -1).join('.') + `_${interpolation}_${dataSize}.png`, mat);
});

program.run();
