import { Application, Utils } from '@nativescript/core';
import { FLAG_IMMUTABLE, NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from '~/services/android/NotifcationHelper';
import { ad } from '@nativescript/core/utils/utils';
import { Color } from '@nativescript/core/color';
import { primaryColor } from '~/variables';
import { addActionCallback, removeNotificationCallbacks } from '~/android/ActionReceiver';
import { notify } from '~/utils';

export interface ProgressOptions {
    id: number;
    title?: string;
    notifTitle?: string;
    message?: string;
    notifMessage?: string;
    smallIcon?: string;
    rightIcon?: string;
    icon?: string;
    rightMessage?: string;
    indeterminate?: boolean;
    progress?: number;
    ongoing?: boolean;
    actions?: {
        icon?: number;
        id: string;
        text: string;
        notifText?: string;
        callback?: Function;
    }[];
}
export interface CommonNotification {
    id: number;
    builder: androidx.core.app.NotificationCompat.Builder;
}

export function show(options: ProgressOptions): CommonNotification {
    const builder = NotificationHelper.getBuilder(getActivity(), NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL);
    builder
        .setContentTitle(options.notifTitle || options.title || '')
        .setContentText(options.notifMessage || options.message || '')
        .setSmallIcon(17301633)
        .setColor(new Color(primaryColor).android)
        .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
        .setOnlyAlertOnce(true);
    if (options.actions) {
        try {
            // console.log('actions', _options.actions);
            const context = Utils.ad.getApplicationContext();
            options.actions.forEach((action) => {
                const intent = new android.content.Intent(context, com.akylas.juleverne.ActionReceiver.class);
                intent.setAction(action.id);
                intent.putExtra('notificationId', options.id);
                const actionBuilder = new androidx.core.app.NotificationCompat.Action.Builder(
                    action.icon || 0,
                    action.notifText || action.text,
                    android.app.PendingIntent.getBroadcast(context, FLAG_IMMUTABLE, intent, android.app.PendingIntent.FLAG_CANCEL_CURRENT)
                ).build();
                builder.addAction(actionBuilder);
                if (action.callback) {
                    addActionCallback(options.id, action.id, action.callback);
                }
            });
        } catch (error) {
            console.error('ProgressNotification.show', error, error.stack);
        }
    }
    builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);
    if (options.ongoing) {
        builder.setOngoing(options.ongoing).setProgress(100, Math.min(options.progress ?? 0, 100), options.indeterminate ?? false);
    }
    NotificationHelper.showNotification(options.id, builder);
    const notification: CommonNotification = {
        id: options.id,
        builder
    };

    const { actions, ...toAdd } = options;
    notify({
        eventName: 'appMessage',
        data: {
            ...toAdd,
            action: actions
                ? {
                      text: actions[0].text,
                      callback: actions[0].callback
                  }
                : null
        }
    });
    return notification;
}
export function update(notification: CommonNotification, options: Partial<ProgressOptions> & { hideProgressBar?: boolean }): CommonNotification {
    const builder = notification.builder;
    const title = options.notifTitle || options.title;
    if (title) {
        builder.setContentTitle(title);
    }
    const message = options.notifMessage || options.message;
    if (message) {
        builder.setContentText(message);
    }
    if (options.progress !== null && options.progress !== undefined) {
        if (options.progress >= 100) {
            options.progress = 100;
        }
        builder.setProgress(100, options.progress, options.indeterminate ?? false);
    }
    if (options.ongoing !== null && options.ongoing !== undefined) {
        builder.setOngoing(options.ongoing);
    }
    if (options.hideProgressBar) {
        builder.setProgress(0, 0, false);
    }
    NotificationHelper.showNotification(notification.id, builder);
    notification.builder = builder;

    notify({
        eventName: 'appMessageUpdate',
        data: options
    });
    return notification;
}
export function dismiss(id: number) {
    NotificationHelper.hideNotification(id);
    removeNotificationCallbacks(id);
    notify({
        eventName: 'appMessageRemove',
        data: { id }
    });
}
export function getActivity() {
    return Application.android.startActivity || Application.android.foregroundActivity;
}
