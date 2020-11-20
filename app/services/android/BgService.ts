import { ApplicationEventData, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
import { GeoHandler, SessionChronoEventData, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';
import { $tc } from '~/helpers/locale';

const NOTIFICATION_ID = 3426824;

@NativeClass
@JavaProxy('com.akylas.juleverne.BgService')
export class BgService extends android.app.Service {
    currentNotifText: string;
    geoHandler: GeoHandler;
    bounded: boolean;
    inBackground: any;
    mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    mNotification: globalAndroid.app.Notification;
    notificationManager: any;
    recording: boolean;
    alwaysShowNotification: boolean;
    log(...args) {
        console.log('[BgService]', ...args);
    }
    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
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
        this.currentNotifText = $tc('tap_to_open');
        this.recording = false;
        this.inBackground = false;
        this.bounded = false;
        this.alwaysShowNotification = false;
        this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannel(this);
    }
    onDestroy() {
        if (this.geoHandler) {
            this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler = null;
        }
        applicationOff(resumeEvent, this.onAppEvent, this);
        applicationOff(suspendEvent, this.onAppEvent, this);
    }

    onBind(intent: android.content.Intent) {
        // a client is binding to the service with bindService()
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        this.bounded = false;
        this.removeForeground();
        return true;
    }
    onRebind(intent: android.content.Intent) {
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    onBounded() {
        this.geoHandler = new GeoHandler();
        if (this.inBackground) {
            this.showForeground();
        }
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        applicationOn(resumeEvent, this.onAppEvent, this);
        applicationOn(suspendEvent, this.onAppEvent, this);
    }

    displayNotification(sessionRunning) {
        this.mNotificationBuilder = new androidx.core.app.NotificationCompat.Builder(this, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL);

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder);
        this.notificationManager.notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }
    dismissNotification() {
        this.stopForeground(false);
        this.notificationManager.cancel(NOTIFICATION_ID); // todo check if necessary?
        this.mNotification = null;
    }
    onSessionStateEvent(e: SessionEventData) {
        switch (e.data.state) {
            case SessionState.RUNNING:
                if (!this.recording) {
                    this.recording = true;
                    this.showForeground();
                }
                break;
            case SessionState.STOPPED:
                this.recording = false;
                this.dismissNotification();
                break;
        }
        this.updateNotification();
    }
    updateNotification() {
        if (!this.mNotificationBuilder) {
            this.displayNotification(this.recording);
        } else {
            this.mNotification = NotificationHelper.getUpdatedNotification(this, this.mNotificationBuilder);
            this.notificationManager.notify(NOTIFICATION_ID, this.mNotification);
        }
    }
    onSessionChronoEvent(e: SessionChronoEventData) {
        this.updateNotification();
    }

    showForeground() {
        if (!this.bounded) {
            return;
        }
        if (this.inBackground || this.recording || this.alwaysShowNotification) {
            try {
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                this.startForeground(NOTIFICATION_ID, this.mNotification);
            } catch (err) {
                console.error(err);
            }
        }
    }

    removeForeground() {
        this.stopForeground(false);
        this.notificationManager.cancel(NOTIFICATION_ID);
        this.mNotification = null;
    }

    onAppEvent(event: ApplicationEventData) {
        if (event.eventName === suspendEvent) {
            if (!this.inBackground) {
                this.inBackground = true;
                if (this.recording) {
                    this.showForeground();
                }
            }
        } else if (event.eventName === resumeEvent) {
            if (this.inBackground) {
                this.inBackground = false;
                if (!this.alwaysShowNotification) {
                    this.removeForeground();
                }
            }
        }
    }
}
