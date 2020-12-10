import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    readonly bluetoothHandler: BluetoothHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler();
        this.bluetoothHandler = new BluetoothHandler();
        this._handlerLoaded();
    }
}
