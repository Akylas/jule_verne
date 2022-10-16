import { GeoHandler } from '~/handlers/GeoHandler';
import Observable from '@nativescript-community/observable';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { StoryHandler } from '~/handlers/StoryHandler';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly bluetoothHandler: BluetoothHandler;
    readonly geoHandler: GeoHandler;
    readonly dbHandler: DBHandler;
    readonly storyHandler: StoryHandler;
    readonly loaded: boolean;
    readonly started: boolean;
    start();
    stop();
}
