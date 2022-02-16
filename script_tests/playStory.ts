import path from 'path';
import { buildDataSet, getFolder, storiesFolder } from './common';
import { program } from '@caporal/core';
import { readFileSync, writeFileSync } from 'fs';
const open = require('open');

// function to encode file data to base64 encoded string
function base64_encode(file) {
    // read binary data
    const bitmap = readFileSync(file);
    // convert binary data to base64 encoded string
    return Buffer.from(bitmap).toString('base64');
}

function prepareLottie(storyFolder) {
    const data = require(path.join(storyFolder, 'composition.json'));
    const imagesMap = require(path.join(storyFolder, 'image_map.json'));
    const assets = {};
    const assetsToAdd = [];
    data.w = 228;
    data.h = 192;
    data.assets.forEach((a) => {
        assets[a.id] = a.layers;
        a.layers.forEach((layer) => {
            const cleaned = layer.nm.split('.')[0];
            if (imagesMap[cleaned] && !assets[layer.refId]) {
                const asset = (assets[layer.refId] = {
                    id: layer.refId,
                    w: 228,
                    h: 192,
                    // e: 1,
                    // u: '',
                    // p: `data:image/png;base64,${base64_encode(path.join(storyImagesFolder, cleaned + '.png'))}`
                    e: 0,
                    u: 'static/images/',
                    p: cleaned + '.png'
                });
                assetsToAdd.push(asset);
            }
        });
    });

    data.layers.forEach((layer) => {
        if (!assets[layer.refId]) {
            const cleaned = layer.nm.split('.')[0];
            if (imagesMap[cleaned]) {
                const asset = (assets[layer.refId] = {
                    id: layer.refId,
                    w: 228,
                    h: 192,
                    // e: 1,
                    // u: '',
                    // p: `data:image/png;base64,${base64_encode(path.join(storyImagesFolder, cleaned + '.png'))}`
                    e: 0,
                    u: 'static/images/',
                    p: cleaned + '.png'
                });
                assetsToAdd.push(asset);
            }
        }
    });
    data.assets.push(...assetsToAdd);
    return data;
}

program
    .option('--id [id]', 'config id', { default: '1' })
    .option('--big', 'big', { default: false })
    .action(({ logger, args, options }) => {
        const express = require('express');
        const app = express();
        const cfgId = options.id + '';
        const myStoriesFolder= storiesFolder + (options.big ? '_big' : '');
        const storyFolder = path.join(myStoriesFolder, cfgId);
        const data = prepareLottie(storyFolder);
        // writeFileSync(path.join(__dirname + '/test.json'), JSON.stringify(data));
        console.log('storyFolder', storyFolder);
        app.get('/', function (req, res) {
            res.sendFile(path.join(__dirname + '/player.html'));
        });
        app.get('/animation.json', function (req, res) {
            // console.log('asking for animation', JSON.stringify(data));
            res.json(data);
        });

        const server = app.listen(2000, function () {
            const host = server.address().address;
            const port = server.address().port;
            app.use('/static', express.static(storyFolder));
            const url = `http://localhost:${port}`;

            const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            require('child_process').exec(start + ' ' + url);
        });
    });

program.run();
