import * as utils from '@nativescript/core/utils/utils';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { IBgServiceBinder } from '~/services/android/BgServiceBinder';
import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';
import { NotificationHelper } from './android/NotifcationHelper';

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
            DEV_LOG && console.log(TAG, 'stop', this._loaded);
            if (this._loaded) {
                this._loaded = false;
                const bgService = this.bgService?.get();
                await super.stop();
                if (bgService) {
                    const context = this.context;
                    bgService.removeForeground();
                    NotificationHelper.hideAllNotifications();
                    const intent = new android.content.Intent(context, com.akylas.juleverne.BgService.class);
                    DEV_LOG && console.log(TAG, 'stopService');
                    context.stopService(intent);
                    context.unbindService(this.serviceConnection);
                }
            }
        } catch (error) {
            console.error('BgService stop failed', error, error.stack);
        }
    }
    async handleBinder(binder: android.os.IBinder) {
        try {
            const bgBinder = binder as IBgServiceBinder;
            const localservice = bgBinder.getService();
            bgBinder.setService(null);
            this.bgService = new WeakRef(localservice);
            localservice.onBounded(this);
            this._handlerLoaded();
            await super.start();
        } catch (err) {
            console.error('BgService start failed', err, err.stack);
        }
    }

    get geoHandler() {
        return this.bgService?.get()?.geoHandler;
    }
    get bluetoothHandler() {
        return this.bgService?.get()?.bluetoothHandler;
    }

    get dbHandler() {
        return this.bgService?.get()?.dbHandler;
    }
    get storyHandler() {
        return this.bgService?.get()?.storyHandler;
    }
}
