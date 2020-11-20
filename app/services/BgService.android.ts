import { BgServiceCommon, BgServiceLoadedEvent } from '~/services/BgService.common';

import * as utils from '@nativescript/core/utils/utils';
import { BgService as AndroidBgService } from '~/services/android/BgService';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';

export { BgServiceLoadedEvent };

export class BgService extends BgServiceCommon {
    private serviceConnection: android.content.ServiceConnection;
    bgService: WeakRef<AndroidBgService>;
    context: android.content.Context;
    constructor() {
        super();
        // initServiceConnection();
        this.serviceConnection = new android.content.ServiceConnection({
            onServiceDisconnected: (name: android.content.ComponentName) => {
                this.log('android service disconnected');
                this.unbindService();
            },

            onServiceConnected: (name: android.content.ComponentName, binder: android.os.IBinder) => {
                this.log('BgServiceProvider', 'onServiceConnected', name, binder);
                this.handleBinder(binder);
            },
            onNullBinding(param0: globalAndroid.content.ComponentName) {
                this.log('BgServiceProvider', 'onNullBinding', param0);
            },
            onBindingDied(param0: globalAndroid.content.ComponentName) {
                this.log('BgServiceProvider', 'onBindingDied', param0);
            }
        });
        this.context = utils.ad.getApplicationContext();
    }

    bindService(context: android.content.Context, intent) {
        this.log('bindService');
        const result = context.bindService(intent, this.serviceConnection, android.content.Context.BIND_AUTO_CREATE);
        if (!result) {
            console.error('could not bind service');
        }
    }
    unbindService() {
        this.log('unbindService');
        this.bgService = null;
        this._loaded = false;
    }

    start() {
        this.log('BgService start', android.os.Build.VERSION.SDK_INT >= 26); // oreo
        return Promise.resolve().then(() => {
            const intent = new android.content.Intent(this.context, com.akylas.juleverne.BgService.class);
            this.log('BgService about to bindService', android.os.Build.VERSION.SDK_INT >= 26); // oreo
            this.bindService(this.context, intent);
        });
    }

    stop() {
        return super.stop().then(() => {
            this.log('stopping background service', !!this.bgService);
            const bgService = this.bgService && this.bgService.get();
            if (bgService) {
                bgService.dismissNotification();
                const intent = new android.content.Intent(this.context, com.akylas.juleverne.BgService.class);
                this.context.stopService(intent);
                this.context.unbindService(this.serviceConnection);
                this._loaded = false;
            }
        });
    }
    handleBinder(binder: android.os.IBinder) {
        const bgBinder = binder as BgServiceBinder;
        const localservice = bgBinder.getService();
        bgBinder.setService(null);
        this.log('handleBinder', binder, localservice);
        // if (localservice/ instanceof AndroidBgService) {
            this.bgService = new WeakRef(localservice);
            localservice.onBounded();
            this._handlerLoaded();
            super.start();
        // }
    }

    get geoHandler() {
        const bgService = this.bgService && this.bgService.get();
        if (bgService) {
            return bgService.geoHandler;
        }
    }
}
