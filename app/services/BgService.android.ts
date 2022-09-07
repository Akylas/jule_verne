import * as utils from '@nativescript/core/utils/utils';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { IBgServiceBinder } from '~/services/android/BgServiceBinder';
import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';

export { BgServiceLoadedEvent };
const TAG = '[BgService]';

export class BgService extends BgServiceCommon {
    private serviceConnection: android.content.ServiceConnection;
    bgService: WeakRef<AndroidBgService>;
    context: android.content.Context;
    constructor() {
        super();
        this.serviceConnection = new android.content.ServiceConnection({
            onServiceDisconnected: (name: android.content.ComponentName) => {
                DEV_LOG && console.log(TAG, 'onServiceDisconnected');
                this.unbindService();
            },

            onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
                DEV_LOG && console.log(TAG, 'onServiceConnected');
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

    async start() {
        DEV_LOG && console.log(TAG, 'start');
        try {
            const context = this.context;
            const intent = new android.content.Intent(context, com.akylas.juleverne.BgService.class);
            this.bindService(context, intent);
        } catch (error) {
            console.error('error starting android service', error);
        }
    }

    async stop() {
        try {
            const bgService = this.bgService?.get();
            DEV_LOG && console.log(TAG, 'stop', bgService);
        await super.stop();
            if (bgService) {
                const context = this.context;
                bgService.removeForeground();
                const intent = new android.content.Intent(context, com.akylas.juleverne.BgService.class);
                DEV_LOG && console.log(TAG, 'stopService');
                context.stopService(intent);
                context.unbindService(this.serviceConnection);
                this._loaded = false;
            }
        } catch (error) {
            console.error('BgService stop failed', error);
        }
    }
    async handleBinder(binder: android.os.IBinder) {
        try {
            const bgBinder = binder as IBgServiceBinder;
            const localservice = bgBinder.getService();
            bgBinder.setService(null);
            this.bgService = new WeakRef(localservice);
            localservice.onBounded();
            this._handlerLoaded();
            await super.start();
        } catch (err) {
            console.error('BgService start failed', err);
        }
    }

    get geoHandler() {
        return this.bgService?.get()?.geoHandler;

    }
    get bluetoothHandler() {
        return this.bgService?.get()?.bluetoothHandler;

    }
}
