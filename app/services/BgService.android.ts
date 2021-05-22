import * as utils from '@nativescript/core/utils/utils';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { IBgServiceBinder } from '~/services/android/BgServiceBinder';
import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    private serviceConnection: android.content.ServiceConnection;
    bgService: WeakRef<AndroidBgService>;
    context: android.content.Context;
    constructor() {
        super();
        this.serviceConnection = new android.content.ServiceConnection({
            onServiceDisconnected: (name: android.content.ComponentName) => {
                this.unbindService();
            },

            onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
                this.handleBinder(binder);
            },
            onNullBinding(param0: globalAndroid.content.ComponentName) {},
            onBindingDied(param0: globalAndroid.content.ComponentName) {}
        });
        this.context = utils.ad.getApplicationContext();
    }

    bindService(context: android.content.Context, intent) {
        const result = context.bindService(intent, this.serviceConnection, android.content.Context.BIND_AUTO_CREATE);
        if (!result) {
            console.error('could not bind service');
        }
    }
    unbindService() {
        this.bgService = null;
        this._loaded = false;
    }

    start() {
        return Promise.resolve().then(() => {
            const intent = new android.content.Intent(this.context, com.akylas.juleverne.BgService.class);
            this.bindService(this.context, intent);
        });
    }

    stop() {
        return super.stop().then(() => {
            const bgService = this.bgService && this.bgService.get();
            if (bgService) {
                bgService.removeForeground();
                const intent = new android.content.Intent(this.context, com.akylas.juleverne.BgService.class);
                this.context.stopService(intent);
                this.context.unbindService(this.serviceConnection);
                this._loaded = false;
            }
        });
    }
    handleBinder(binder: android.os.IBinder) {
        const bgBinder = binder as IBgServiceBinder;
        const localservice = bgBinder.getService();
        bgBinder.setService(null);
        this.bgService = new WeakRef(localservice);
        localservice.onBounded();
        this._handlerLoaded();
        super.start();
    }

    get geoHandler() {
        const bgService = this.bgService && this.bgService.get();
        if (bgService) {
            return bgService.geoHandler;
        }
    }
    get bluetoothHandler() {
        const bgService = this.bgService && this.bgService.get();
        if (bgService) {
            return bgService.bluetoothHandler;
        }
    }
}
