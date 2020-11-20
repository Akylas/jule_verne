import { GeoHandler } from '~/handlers/GeoHandler';
import  Observable  from '@nativescript-community/observable';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    readonly started: boolean;
    start()
    stop()
}
