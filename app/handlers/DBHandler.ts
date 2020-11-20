import { EventData, Observable } from '@nativescript/core/data/observable';

import { GeoLocation } from './GeoHandler';
import { computeDistance, getBounds } from '~/helpers/geo';
import { simplify } from '~/helpers/simplify';
import { File, knownFolders, path } from '@nativescript/core/file-system';
import { GenericGeoLocation } from '@nativescript-community/gps';

const average = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;
const PRESSURE_STANDARD_ATMOSPHERE = 1013.25;

export interface OldStoredSession {
    name?: string;
    desc?: string;
    speed_avg: number;
    altitudeGain: number;
    altitudeNegative: number;
    startTime: number;
    currentDistance: number;
    endTime: number;
    pauseDuration: number;
    locs: GenericGeoLocation[];
}

import { installMixins } from '@akylas/nativescript-sqlite/typeorm';

import { Connection, createConnection } from '@nativescript-community/typeorm/browser';
import Track from '../models/Track';
import { pick } from '~/utils';

export class DBHandler extends Observable {
    log(...args) {
        console.log('[' + this.constructor.name + ']', ...args);
    }
    connection: Connection;
    started = false;
    async start() {
        const filePath = path.join(knownFolders.documents().getFolder('db').path, 'db.sqlite');
        installMixins();

        this.connection = await createConnection({
            database: filePath,
            type: '@akylas/nativescript-sqlite' as any,
            entities: [Track],
            logging: DEV_LOG
        });

        if (DEV_LOG) {
            this.log('Connection Created');
        }

        await this.connection.synchronize(false);

        if (DEV_LOG) {
            this.log('about to create database', filePath);
        }
        this.started = true;
    }
    stop() {
        return this.connection.close();
    }

    // async loadRawSession(sessionId) {
    //     const dataFolder = knownFolders.documents().getFolder('rawData');
    //     if (File.exists(path.join(dataFolder.path, `${sessionId}.json`))) {
    //         const sessionFile = dataFolder.getFile(`${sessionId}.json`);
    //         const data = await sessionFile.readText();
    //         return JSON.parse(data).positions;
    //     }
    // }
    _devMode: boolean = false;
    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
    }
}
