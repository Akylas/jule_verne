import { Color, Device, Utils } from '@nativescript/core';
import { ad } from '@nativescript/core/utils/utils';
import { $tc } from '~/helpers/locale';
import { primaryColor } from '~/variables';

export const ACTION_START = '.action.START';
export const ACTION_STOP = '.action.STOP';
export const ACTION_RESUME = '.action.RESUME';
export const ACTION_PAUSE = '.action.PAUSE';
export const NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL = 'juleverne_service';
export const NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL = 'juleverne_download';
export const NOTIFICATION_CHANEL_ID_MUSIC_CHANNEL = 'juleverne_music';
export const FLAG_IMMUTABLE = 0x04000000; //android.app.PendingIntent.FLAG_IMMUTABLE

const sdkVersion = parseInt(Device.sdkVersion, 10);

const notificationIcon = ad.resources.getDrawableId('ic_notification');

function titlecase(value) {
    return value.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
export class NotificationHelper {
    public static getNotification(context: android.content.Context, builder: androidx.core.app.NotificationCompat.Builder) {
        // NotificationHelper.createNotificationChannels(context);

        const activityClass = (com as any).tns.NativeScriptActivity.class;
        // ACTION: NOTIFICATION TAP & BUTTON SHOW
        const tapActionIntent = new android.content.Intent(context, activityClass);
        tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
        tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
        const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, FLAG_IMMUTABLE);
        builder
            .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_SECRET)
            .setShowWhen(false)
            .setOngoing(true)
            .setColor(new Color(primaryColor).android)
            .setOnlyAlertOnce(true)
            .setSound(null)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MIN)
            .setContentIntent(tapActionPendingIntent)
            .setSmallIcon(notificationIcon);
        NotificationHelper.updateBuilderTexts(builder);
        return builder.build();
    }

    public static updateBuilderTexts(builder) {
        builder.setContentTitle(null);
        builder.setContentText(titlecase($tc('tap_to_open')));
    }

    /* Constructs an updated notification */
    public static getUpdatedNotification(builder) {
        NotificationHelper.updateBuilderTexts(builder);
        return builder.build();
    }

    static mNotificationManager: android.app.NotificationManager;
    public static getNotificationManager() {
        if (!NotificationHelper.mNotificationManager) {
            const context = Utils.ad.getApplicationContext();
            NotificationHelper.mNotificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        }
        return NotificationHelper.mNotificationManager;
    }

    /* Create a notification channel */
    public static createNotificationChannels(context) {
        if (sdkVersion >= 26) {
            const color = new Color(primaryColor).android;
            // API level 26 ("Android O") supports notification channels.
            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;

            // create channel
            const channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, $tc('session_state'), android.app.NotificationManager.IMPORTANCE_MIN);
            channel.setDescription($tc('notification_state_desc'));
            channel.setLightColor(color);

            service.createNotificationChannel(channel);
            const channelDownloads = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_DOWNLOAD_CHANNEL, $tc('download'), android.app.NotificationManager.IMPORTANCE_HIGH);

            channelDownloads.setDescription($tc('notification_download_desc'));
            channelDownloads.setLightColor(color);
            channelDownloads.setSound(null, null);
            service.createNotificationChannel(channelDownloads);

            const channelMusic = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_MUSIC_CHANNEL, $tc('music_notification'), android.app.NotificationManager.IMPORTANCE_LOW);
            channelMusic.setDescription($tc('notification_music_desc'));
            channelMusic.setLightColor(color);
            service.createNotificationChannel(channelMusic);
            return true;
        } else {
            return false;
        }
    }
    public static showNotification(id: number, builder: androidx.core.app.NotificationCompat.Builder) {
        NotificationHelper.getNotificationManager().notify(id, builder.build());
    }
    public static hideNotification(id) {
        NotificationHelper.getNotificationManager().cancel(id);
    }

    public static getBuilder(context, channel) {
        return new androidx.core.app.NotificationCompat.Builder(context, channel);
    }

    public static getMediaNotification(context, mediaSession) {
        const controller = mediaSession.getController();
        const mediaMetadata = controller.getMetadata();
        const description = mediaMetadata.getDescription();

        const NotificationCompat = androidx.core.app.NotificationCompat;
        const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
        const builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANEL_ID_MUSIC_CHANNEL);
        builder
            .setContentTitle(description.getTitle())
            .setContentText(description.getSubtitle())
            .setSmallIcon(notificationIcon)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
            .setSubText(description.getDescription())
            .setLargeIcon(description.getIconBitmap())
            .setContentIntent(controller.getSessionActivity())
            .setOngoing(true)
            .setDeleteIntent(androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        return builder;
    }
}
