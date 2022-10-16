import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { GeoHandler } from '~/handlers/GeoHandler';
import { BluetoothHandler } from '~/handlers/BluetoothHandler';
import { DBHandler } from '~/handlers/DBHandler';
import { StoryHandler } from '~/handlers/StoryHandler';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    readonly geoHandler: GeoHandler;
    readonly bluetoothHandler: BluetoothHandler;
    readonly dbHandler: DBHandler;
    readonly storyHandler: StoryHandler;
    constructor() {
        super();
        this.geoHandler = new GeoHandler();
        this.bluetoothHandler = new BluetoothHandler();
        this.dbHandler = new DBHandler();
        this.storyHandler = new StoryHandler();
        this._handlerLoaded();
    }
}
