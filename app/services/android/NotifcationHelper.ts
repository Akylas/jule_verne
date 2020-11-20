import { SessionState } from '~/handlers/GeoHandler';
import { UNITS, convertDuration, formatValueToUnit } from '~/helpers/formatter';
import { ad } from '@nativescript/core/utils/utils';

export const ACTION_START = '.action.START';
export const ACTION_STOP = '.action.STOP';
export const ACTION_RESUME = '.action.RESUME';
export const ACTION_PAUSE = '.action.PAUSE';
export const NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL = 'juleverne_service';

import { primaryColor } from '~/variables';
import { $tc } from '~/helpers/locale';
import { getBoolean } from '@nativescript/core/application-settings';

function titlecase(value) {
    return value.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
export class NotificationHelper {
    public static getNotification(context: android.content.Context, builder: androidx.core.app.NotificationCompat.Builder) {
        const color = android.graphics.Color.parseColor(primaryColor);
        NotificationHelper.createNotificationChannel(context);

        const activityClass = (com as any).tns.NativeScriptActivity.class;
        // ACTION: NOTIFICATION TAP & BUTTON SHOW
        const tapActionIntent = new android.content.Intent(context, activityClass);
        tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
        tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
        // artificial back stack for started Activity (https://developer.android.com/training/notify-user/navigation.html#DirectEntry)
        // const tapActionIntentBuilder = TaskStackBuilder.create(context);
        // tapActionIntentBuilder.addParentStack(MainActivity.class);
        // tapActionIntentBuilder.addNextIntent(tapActionIntent);
        // pending intent wrapper for notification tap
        const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);
        // tapActionIntentBuilder.getPendingIntent(10, PendingIntent.FLAG_UPDATE_CURRENT);

        // ACTION: NOTIFICATION BUTTON STOP
        // const stopActionIntent = new android.content.Intent(context, activityClass);
        // stopActionIntent.setAction(ACTION_STOP);
        // pending intent wrapper for notification stop action
        // const stopActionPendingIntent = android.app.PendingIntent.getService(context, 14, stopActionIntent, 0);

        // ACTION: NOTIFICATION BUTTON RESUME
        // const resumeActionIntent = new android.content.Intent(context, activityClass);
        // resumeActionIntent.setAction(ACTION_RESUME);
        // pending intent wrapper for notification resume action
        // const resumeActionPendingIntent = android.app.PendingIntent.getService(context, 16, resumeActionIntent, 0);

        // construct notification in builder
        builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_SECRET);
        builder.setShowWhen(false);
        builder.setOngoing(true);
        builder.setColor(color);
        builder.setOnlyAlertOnce(true);
        builder.setPriority(androidx.core.app.NotificationCompat.PRIORITY_MIN);
        builder.setContentIntent(tapActionPendingIntent);
        builder.setSmallIcon(ad.resources.getDrawableId('ic_stat'));
        // builder.setLargeIcon(NotificationHelper.getNotificationIconLarge(context, tracking));
        NotificationHelper.updateBuilderTexts(builder);
        return builder.build();
    }

    public static updateBuilderTexts(builder) {
        builder.setContentTitle(null);
        // if (session) {
            // builder.setContentText(NotificationHelper.getSessionString(session));
        // } else {
            builder.setContentText(titlecase($tc('tap_to_open')));
        // }
    }

    /* Constructs an updated notification */
    public static getUpdatedNotification(context, builder) {
        NotificationHelper.updateBuilderTexts(builder);
        return builder.build();
    }

    /* Create a notification channel */
    public static createNotificationChannel(context) {
        const color = android.graphics.Color.parseColor(primaryColor);
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            // API level 26 ("Android O") supports notification channels.
            const channelName = 'Session State';
            const channelDescription = 'Display duration and distance. Option to stop session.';

            // create channel
            const channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, channelName, android.app.NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(channelDescription);
            channel.setLightColor(color);

            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
            service.createNotificationChannel(channel);
            return true;
        } else {
            return false;
        }
    }

    /* Get station image for notification's large icon */
    private static getNotificationIconLarge(context, tracking) {
        let bitmap;
        if (tracking) {
            bitmap = ad.resources.getDrawableId('big_icon_tracking');
        } else {
            bitmap = ad.resources.getDrawableId('big_icon_not_tracking');
        }
        return bitmap;
    }

    private static getBitmap(context, resource) {
        // const drawable = VectorDrawableCompat.create(context.getResources(), resource, null);
        // if (drawable != null) {
        //     Bitmap bitmap = Bitmap.createBitmap(drawable.getIntrinsicWidth(), drawable.getIntrinsicHeight(), Bitmap.Config.ARGB_8888);
        //     Canvas canvas = new Canvas(bitmap);
        //     drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        //     drawable.draw(canvas);
        //     return bitmap;
        // } else {
        return null;
        // }
    }

    /* Build context text for notification builder */
    // private static getSessionString(session: RunningSession) {
    //     const imperialUnit = getBoolean('unit_imperial', false);
    //     if (session.state === SessionState.RUNNING) {
    //         return `${$tc('distance')}: ${formatValueToUnit(session.distance, UNITS.DistanceKm, imperialUnit)} | ${$tc('duration')}: ${convertDuration(
    //             Date.now() - session.startTime.getTime() - session.pauseDuration,
    //             'HH:mm:ss'
    //         )}`;
    //     } else if (session.state === SessionState.PAUSED) {
    //         return `${$tc('distance')}: ${formatValueToUnit(session.distance, UNITS.DistanceKm, imperialUnit)} | ${$tc('duration')}: ${convertDuration(
    //             session.lastPauseTime.getTime() - session.startTime.getTime() - session.pauseDuration,
    //             'HH:mm:ss'
    //         )}`;
    //     } else {
    //         return null;
    //     }
    // }
}
