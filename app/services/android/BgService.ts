import { ApplicationEventData, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
import { GeoHandler, SessionChronoEventData, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';
import { $tc } from '~/helpers/locale';
import { BluetoothHandler, GlassesConnectedEvent, GlassesDisconnectedEvent } from '~/handlers/BluetoothHandler';

const NOTIFICATION_ID = 3426824;

@NativeClass
@JavaProxy('com.akylas.juleverne.BgService')
export class BgService extends android.app.Service {
    currentNotifText: string;
    geoHandler: GeoHandler;
    bluetoothHandler: BluetoothHandler;
    bounded: boolean;
    inBackground: any;
    mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    mNotification: globalAndroid.app.Notification;
    notificationManager: any;
    recording: boolean;
    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        DEV_LOG && console.log('onStartCommand');
        this.onStartCommand(intent, flags, startId);
        const action = intent ? intent.getAction() : null;
        if (action === ACTION_RESUME) {
            this.geoHandler.resumeSession();
        } else if (action === ACTION_PAUSE) {
            this.geoHandler.pauseSession();
        }
        return android.app.Service.START_STICKY;
    }
    onCreate() {
        DEV_LOG && console.log('onCreate');
        this.currentNotifText = $tc('tap_to_open');
        this.recording = false;
        this.inBackground = false;
        this.bounded = false;
        this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannels(this);
    }
    onDestroy() {
        DEV_LOG && console.log('onDestroy');
        this.bluetoothHandler.off(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
        if (this.geoHandler) {
            this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler = null;
        }
        // applicationOff(resumeEvent, this.onAppEvent, this);
        // applicationOff(suspendEvent, this.onAppEvent, this);
    }

    onBind(intent: android.content.Intent) {
        // a client is binding to the service with bindService()
        DEV_LOG && console.log('onBind');
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        DEV_LOG && console.log('onUnbind');
        this.bounded = false;
        this.removeForeground();
        return true;
    }
    onRebind(intent: android.content.Intent) {
        DEV_LOG && console.log('onRebind');
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    onBounded() {
        DEV_LOG && console.log('onBounded');
        this.geoHandler = new GeoHandler();
        this.bluetoothHandler = new BluetoothHandler();
        this.showForeground();
        this.bluetoothHandler.on(GlassesConnectedEvent, this.onGlassesConnected, this);
        this.bluetoothHandler.on(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        // this.geoHandler.on(SessionChronoEvent, this.onSessionChronoEvent, this);
    }

    displayNotification(sessionRunning) {
        this.mNotificationBuilder = new androidx.core.app.NotificationCompat.Builder(this, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL);

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder);
        this.notificationManager.notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }
    onSessionStateEvent(e: SessionEventData) {
        switch (e.data.state) {
            case SessionState.RUNNING:
                this.recording = true;
                this.showForeground();
                break;
            case SessionState.STOPPED:
                this.recording = false;
                this.removeForeground();
                break;
        }
        this.updateNotification();
    }
    updateNotification() {
        try {
            if (!this.mNotificationBuilder) {
                this.displayNotification(this.recording);
            } else {
                this.mNotification = NotificationHelper.getUpdatedNotification(this, this.mNotificationBuilder);
                this.notificationManager.notify(NOTIFICATION_ID, this.mNotification);
            }
        } catch (err) {
            console.error('updateNotification', err);
        }
    }
    onSessionChronoEvent(e: SessionChronoEventData) {
        if (this.mNotification) {
            this.updateNotification();
        }
    }

    showForeground() {
        if (!this.bounded) {
            return;
        }
        if (!!this.bluetoothHandler.glasses && this.recording) {
            try {
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                console.error('startForeground');
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    this.startForeground(
                        NOTIFICATION_ID,
                        this.mNotification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION | android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                    );
                } else {
                    this.startForeground(NOTIFICATION_ID, this.mNotification);
                }
            } catch (err) {
                console.error('showForeground', err);
            }
        }
    }

    removeForeground() {
        try {
            console.log('removeForeground', this.recording, !!this.bluetoothHandler.glasses);
            if (!this.recording || !this.bluetoothHandler.glasses) {
                this.stopForeground(false);
                this.notificationManager.cancel(NOTIFICATION_ID);
                this.mNotification = null;
            }
        } catch (err) {
            console.error('removeForeground', err);
        }
    }

    onGlassesDisconnected() {
        this.removeForeground();
    }
    onGlassesConnected() {
        this.showForeground();
    }
}
