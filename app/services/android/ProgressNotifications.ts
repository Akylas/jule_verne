import { Application, Utils } from '@nativescript/core';
import { NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL } from '~/services/android/NotifcationHelper';
import { ad } from '@nativescript/core/utils/utils';
import { Color } from '@nativescript/core/color';
import { primaryColor } from '~/variables';
import { addActionCallback, removeNotificationCallbacks } from '~/android/ActionReceiver';
import { notify } from '~/utils';

export interface ProgressOptions {
    id: number;
    title?: string;
    message?: string;
    indeterminate?: boolean;
    progressValue?: number;
    ongoing?: boolean;
    actions?: {
        icon?: number;
        id: string;
        text: string;
        callback?: Function;
    }[];
}
export interface CommonNotification {
    id: number;
    builder: androidx.core.app.NotificationCompat.Builder;
}
export interface UpdateOptions {
    title?: string;
    message?: string;
    indeterminate?: boolean;
    progressValue?: number;
    ongoing?: boolean;
    hideProgressBar?: boolean;
}

export function show(_options: ProgressOptions): CommonNotification {
    // console.log('show', _options);
    const options: ProgressOptions = {
        id: _options.id,
        title: _options.title ? _options.title : ' ',
        message: _options.message ? _options.message : ' ',
        indeterminate: _options.indeterminate !== undefined && _options.indeterminate !== null ? _options.indeterminate : false,
        progressValue: _options.progressValue !== undefined && _options.progressValue !== null ? _options.progressValue : 0,
        ongoing: _options.ongoing !== undefined && _options.ongoing !== null ? _options.ongoing : true
    };
    const builder = getBuilder();
    const color = android.graphics.Color.parseColor(new Color(primaryColor).hex);
    builder.setContentTitle(options.title).setContentText(options.message).setSmallIcon(ad.resources.getDrawableId('ic_notification')).setColor(color);
    builder.setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX);
    builder.setOnlyAlertOnce(true);
    const REQUEST_CODE = 200;
    if (_options.actions) {
        try {
            // console.log('actions', _options.actions);
            const context = Utils.ad.getApplicationContext();
            _options.actions.forEach((action) => {
                const intent = new android.content.Intent(context, com.akylas.juleverne.ActionReceiver.class);
                intent.setAction(action.id);
                intent.putExtra('notificationId', options.id);
                const actionBuilder = new androidx.core.app.NotificationCompat.Action.Builder(
                    action.icon || 0,
                    action.text,
                    android.app.PendingIntent.getBroadcast(context, 0, intent, android.app.PendingIntent.FLAG_CANCEL_CURRENT)
                ).build();
                builder.addAction(actionBuilder);
                if (action.callback) {
                    addActionCallback(options.id, action.id, action.callback);
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
    builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);
    if (options.ongoing) {
        if (options.progressValue >= 100) {
            options.progressValue = 100;
        }
        builder.setOngoing(options.ongoing).setProgress(100, options.progressValue, options.indeterminate);
    }
    showNotification(options.id, builder);
    const notification: CommonNotification = {
        id: options.id,
        builder
    };
    notify({
        eventName: 'appMessage',
        data: {
            id: options.id,
            title: options.title,
            message: options.message,
            progress: options.progressValue,
            action: _options.actions
                ? {
                      text: _options.actions[0].text,
                      callback: _options.actions[0].callback
                  }
                : null
        }
    });
    return notification;
}
export function update(notification: CommonNotification, options: UpdateOptions): CommonNotification {
    const builder = notification.builder;
    if (options.title !== null && options.title !== undefined) {
        builder.setContentTitle(options.title);
    }
    if (options.message !== null && options.message !== undefined) {
        builder.setContentText(options.message);
    }
    if (options.progressValue !== null && options.progressValue !== undefined) {
        if (options.progressValue >= 100) {
            options.progressValue = 100;
        }
        if (options.indeterminate !== null && options.indeterminate !== undefined) {
            builder.setProgress(100, options.progressValue, options.indeterminate);
        } else {
            builder.setProgress(100, options.progressValue, false);
        }
    }
    if (options.ongoing !== null && options.ongoing !== undefined) {
        builder.setOngoing(options.ongoing);
    }
    if (options.hideProgressBar) {
        builder.setProgress(0, 0, false);
    }
    showNotification(notification.id, builder);
    notification.builder = builder;

    notify({
        eventName: 'appMessageUpdate',
        data: {
            id: notification.id,
            title: options.title,
            message: options.message,
            progress: options.progressValue
        }
    });
    return notification;
}
export function dismiss(id: number) {
    getNotificationManager().cancel(id);
    removeNotificationCallbacks(id);
    notify({
        eventName: 'appMessageRemove',
        data: { id }
    });
}
export function showNotification(id: number, builder: androidx.core.app.NotificationCompat.Builder) {
    getNotificationManager().notify(id, builder.build());
}
export function getBuilder(): androidx.core.app.NotificationCompat.Builder {
    return new androidx.core.app.NotificationCompat.Builder(getActivity(), NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL);
}
export function getActivity() {
    return Application.android.startActivity || Application.android.foregroundActivity;
}
export function getNotificationManager(): android.app.NotificationManager {
    const context = Application.android.context;
    return context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
}
