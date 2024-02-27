import { GenericGeoLocation } from '@nativescript-community/gps';
import { request } from '@nativescript-community/perms';
import { Observable } from '@nativescript/core/data/observable';
import { knownFolders, path } from '@nativescript/core/file-system';
import { TrackRepository } from '../models/Track';
import { Handler } from './Handler';
import NSQLDatabase from './NSQLDatabase';
import { ANDROID_30, askForManagePermission, checkManagePermission } from '~/utils/utils.android';
import { $tc } from '~/helpers/locale';

const TAG = '[DB]';

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

export class DBHandler extends Handler {
    started = false;

    db: NSQLDatabase;
    trackRepository: TrackRepository;
    async start() {
        await request('storage');
        if (__ANDROID__) {
            if (ANDROID_30) {
                await askForManagePermission();
                if (!checkManagePermission()) {
                    throw new Error($tc('missing_manage_permission'));
                }
            }
        }
        const filePath = path.join(knownFolders.documents().getFolder('db').path, 'db.sqlite');
        this.db = new NSQLDatabase(filePath, {
            // for now it breaks
            // threading: true,
            transformBlobs: false
        } as any);
        this.trackRepository = new TrackRepository(this.db);
        await this.trackRepository.createTables();
        this.started = true;
    }
    async stop() {
        try {
            await this.db?.disconnect();
        } catch (error) {
            console.error('DBHandler', 'stop', error);
        }
    }

    getItem(itemId: string) {
        return this.trackRepository.getItem(itemId);
    }
    _devMode: boolean = false;
    get devMode() {
        return this._devMode;
    }
    set devMode(value: boolean) {
        this._devMode = value;
    }
}
