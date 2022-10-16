import { Observable } from '@nativescript/core/data/observable';
import { BgServiceCommon } from '~/services/BgService.common';
export abstract class Handler extends Observable {
    constructor(protected service: BgServiceCommon) {
        super();
    }

    get geoHandler() {
        return this.service.geoHandler;
    }
    get bluetoothHandler() {
        return this.service.bluetoothHandler;
    }

    get dbHandler() {
        return this.service.dbHandler;
    }
    get storyHandler() {
        return this.service.storyHandler;
    }
}
