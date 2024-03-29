import { Device, ImageSource, Utils } from '@nativescript/core';
import { Canvas, ColorMatrixColorFilter, Paint } from '@nativescript-community/ui-canvas';
import { GeoHandler, SessionChronoEventData, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, FLAG_IMMUTABLE, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';
import { $tc } from '~/helpers/locale';
import { BluetoothHandler, GlassesConnectedEvent, GlassesDisconnectedEvent } from '~/handlers/BluetoothHandler';
// import { MediaSessionCompatCallback } from './MediaSessionCompatCallback';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import { createColorMatrix } from '~/utils';
import { accentColor } from '~/variables';
import { DBHandler } from '~/handlers/DBHandler';
import { DrawBitmapEvent, PlaybackEvent, PlaybackStartEvent, PlayingInfo, StoryHandler } from '~/handlers/StoryHandler';
import { BgServiceCommon } from '../BgService.common';

const NOTIFICATION_ID = 3426824;
const PLAYING_NOTIFICATION_ID = 123512;

const sdkVersion = parseInt(Device.sdkVersion, 10);

let instance: BgService;
export function getInstance() {
    return instance;
}
const TAG = '[BgServiceAndroid]';

const ic_play_id = Utils.android.resources.getId(':drawable/' + 'icon_play');
const ic_pause_id = Utils.android.resources.getId(':drawable/' + 'icon_pause');
const ic_stop_id = Utils.android.resources.getId(':drawable/' + 'ic_end');

function modifyBitmap(original, colorMatrix: number[]) {
    const canvas = new Canvas(original);
    const paint = new Paint();
    let arr = colorMatrix;
    if (Array.isArray(colorMatrix)) {
        arr = Array.create('float', colorMatrix.length);
        for (let index = 0; index < colorMatrix.length; index++) {
            arr[index] = colorMatrix[index];
        }
    }
    paint.setColorFilter(new android.graphics.ColorMatrixColorFilter(arr));
    canvas.drawBitmap(original, 0, 0, paint);
    return canvas.getImage();
}

@NativeClass
@JavaProxy('com.akylas.juleverne.BgService')
export class BgService extends android.app.Service {
    currentNotifText: string;
    geoHandler: GeoHandler;
    bluetoothHandler: BluetoothHandler;
    dbHandler: DBHandler;
    storyHandler: StoryHandler;
    bounded: boolean;
    inBackground: any;
    mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    mNotification: android.app.Notification;
    // notificationManager: android.app.NotificationManager;
    recording: boolean;
    playingState: 'play' | 'pause' | 'stopped' = 'stopped';
    playingInfo: PlayingInfo = null;

    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        super.onStartCommand(intent, flags, startId);
        console.log('onStartCommand', intent);
        if (!instance) {
            instance = this;
        }
        if (intent != null) {
            com.akylas.juleverne.CustomMediaButtonReceiver.handleIntent(this.getMediaSessionCompat(), intent);
        }
        // const action = intent ? intent.getAction() : null;
        // if (action === ACTION_RESUME) {
        //     this.geoHandler.resumeSession();
        // } else if (action === ACTION_PAUSE) {
        //     this.geoHandler.pauseSession();
        // }
        return android.app.Service.START_STICKY;
    }
    onCreate() {
        if (!instance) {
            instance = this;
        }
        DEV_LOG && console.log(TAG, 'onCreate');
        this.currentNotifText = $tc('tap_to_open');
        this.recording = false;
        this.inBackground = false;
        this.bounded = false;
        // this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannels(this);
    }
    onDestroy() {
        DEV_LOG && console.log(TAG, 'onDestroy');
        this.bluetoothHandler.off(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
        if (this.geoHandler) {
            this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler = null;
        }
        // applicationOff(resumeEvent, this.onAppEvent, this);
        // applicationOff(suspendEvent, this.onAppEvent, this);
    }

    onBind(intent: android.content.Intent) {
        DEV_LOG && console.log(TAG, 'onBind');
        // a client is binding to the service with bindService()
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        DEV_LOG && console.log(TAG, 'onUnbind');
        this.bounded = false;
        const bluetoothHandler = this.bluetoothHandler;
        const storyHandler = this.storyHandler;
        this.removeForeground();
        bluetoothHandler.off(GlassesConnectedEvent, this.onGlassesConnected, this);
        bluetoothHandler.off(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
        storyHandler.off(PlaybackEvent, this.onPlayerState, this);
        storyHandler.off(PlaybackStartEvent, this.onPlayerStart, this);
        storyHandler.off(DrawBitmapEvent, this.onDrawImage, this);
        return true;
    }
    onRebind(intent: android.content.Intent) {
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    onBounded(commonService: BgServiceCommon) {
        try {
            DEV_LOG && console.log(TAG, 'onBounded');
            this.geoHandler = new GeoHandler(commonService);
            const bluetoothHandler = (this.bluetoothHandler = new BluetoothHandler(commonService));
            this.dbHandler = new DBHandler(commonService);
            this.storyHandler = new StoryHandler(commonService);
            this.showForeground();
            bluetoothHandler.on(GlassesConnectedEvent, this.onGlassesConnected, this);
            bluetoothHandler.on(GlassesDisconnectedEvent, this.onGlassesDisconnected, this);
            this.storyHandler.on(PlaybackEvent, this.onPlayerState, this);
            this.storyHandler.on(PlaybackStartEvent, this.onPlayerStart, this);
            this.storyHandler.on(DrawBitmapEvent, this.onDrawImage, this);
            this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        } catch (error) {
            console.error('onBounded', error, error.stack);
        }
    }

    displayNotification(sessionRunning) {
        DEV_LOG && console.log(TAG, 'displayNotification', sessionRunning);
        this.mNotificationBuilder = NotificationHelper.getBuilder(this, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL);

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder);
        // NotificationHelper.getNotificationManager().notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }
    onSessionStateEvent(e: SessionEventData) {
        DEV_LOG && console.log(TAG, 'onSessionStateEvent', e.data);
        switch (e.data.state) {
            case SessionState.RUNNING:
                this.recording = true;
                this.showForeground();
                // we dont need to update the notification as it is a fixed notification
                // this.updateNotification();
                break;
            case SessionState.STOPPED:
                this.recording = false;
                this.removeForeground();
                break;
        }
    }
    updateNotification() {
        try {
            DEV_LOG && console.log(TAG, 'updateNotification', this.recording, sdkVersion);
            if (!this.mNotificationBuilder) {
                this.displayNotification(this.recording);
            } else {
                this.mNotification = NotificationHelper.getUpdatedNotification(this.mNotificationBuilder);
                NotificationHelper.getNotificationManager().notify(NOTIFICATION_ID, this.mNotification);
            }
        } catch (err) {
            console.error('updateNotification', err);
        }
    }
    // onSessionChronoEvent(e: SessionChronoEventData) {
    //     if (this.mNotification) {
    //         this.updateNotification();
    //     }
    // }

    showForeground() {
        if (!this.bounded) {
            return;
        }
        if (this.recording || this.bluetoothHandler.glasses) {
            try {
                DEV_LOG && console.log(TAG, 'showForeground', this.recording, sdkVersion, !this.bluetoothHandler.glasses);
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                if (sdkVersion >= 29) {
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
            DEV_LOG && console.log(TAG, 'removeForeground', this.recording, !!this.bluetoothHandler.glasses);
            if (!this.recording && !this.bluetoothHandler.glasses) {
                // NotificationHelper.getNotificationManager().cancel(NOTIFICATION_ID);
                this.stopForeground(true);
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

    mMediaSessionCompat: android.support.v4.media.session.MediaSessionCompat;

    getMediaSessionCompat() {
        if (!this.mMediaSessionCompat) {
            this.createMediaSession();
        }
        return this.mMediaSessionCompat;
    }
    stateBuilder: android.support.v4.media.session.PlaybackStateCompat.Builder;
    createMediaSession() {
        try {
            const context = Utils.ad.getApplicationContext();
            const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
            const MediaSessionCompat = android.support.v4.media.session.MediaSessionCompat;
            const mediaSessionCompat = (this.mMediaSessionCompat = new MediaSessionCompat(context, 'AudioPlayer'));
            mediaSessionCompat.setActive(true);
            mediaSessionCompat.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

            const stateBuilder = (this.stateBuilder = new PlaybackStateCompat.Builder().setActions(
                PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
            ));
            const mediaButtonIntent = new android.content.Intent(android.content.Intent.ACTION_MEDIA_BUTTON);
            mediaButtonIntent.setClass(context, com.akylas.juleverne.CustomMediaButtonReceiver.class);
            const pendingIntent = android.app.PendingIntent.getBroadcast(this, 0, mediaButtonIntent, FLAG_IMMUTABLE);
            mediaSessionCompat.setMediaButtonReceiver(pendingIntent);
            mediaSessionCompat.setPlaybackState(stateBuilder.build());

            // @NativeClass
            // class MediaSessionCompatCallback extends android.support.v4.media.session.MediaSessionCompat.Callback {
            //     constructor(private impl) {
            //         super();
            //         return global.__native(this);
            //     }

            //     onPlay() {
            //         console.log('MediaSessionCompatCallback', 'onPlay');
            //         super.onPlay();
            //     }
            //     onPause() {
            //         console.log('MediaSessionCompatCallback', 'onPause');
            //         super.onPause();
            //     }

            //     onSkipToNext() {
            //         console.log('MediaSessionCompatCallback', 'onSkipToNext');
            //         super.onSkipToNext();
            //     }

            //     onSkipToPrevious() {
            //         console.log('MediaSessionCompatCallback', 'onSkipToPrevious');
            //         super.onSkipToPrevious();
            //     }
            //     onPlayFromMediaId(mediaId, extras) {
            //         console.log('MediaSessionCompatCallback', 'onPlayFromMediaId');
            //         super.onPlayFromMediaId(mediaId, extras);
            //     }
            //     onCommand(command, extras, cb) {
            //         console.log('MediaSessionCompatCallback', 'onCommand');
            //         super.onCommand(command, extras, cb);
            //     }
            //     onSeekTo(pos) {
            //         console.log('MediaSessionCompatCallback', 'onSeekTo');
            //         super.onSeekTo(pos);
            //     }
            //     onMediaButtonEvent(mediaButtonIntent) {
            //         const action = mediaButtonIntent.getAction();
            //         console.log('MediaSession', 'Intent Action' + action);
            //         if (android.content.Intent.ACTION_MEDIA_BUTTON === mediaButtonIntent.getAction()) {
            //             const event = mediaButtonIntent.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT);
            //             console.log('MediaSession', 'KeyCode' + event.getKeyCode());
            //             return true;
            //         }
            //         return super.onMediaButtonEvent(mediaButtonIntent);
            //     }
            // }
            // mediaSessionCompat.setCallback(
            //     new MediaSessionCompatCallback({
            //         onPlay: () => {
            //             this.getMediaSessionCompat().setActive(true);
            //             this.setMediaPlaybackState(PlaybackStateCompat.STATE_PLAYING);
            //             this.showPlayingNotification();
            //         },
            //         onPause: () => {
            //             if (this.playingState === 'play') {
            //                 this.bluetoothHandler.pauseStory();
            //                 this.setMediaPlaybackState(PlaybackStateCompat.STATE_PAUSED);
            //                 this.showPausedNotification();
            //             }
            //         }
            //     })
            // );
        } catch (error) {
            console.error('createMediaSession', error, error.stack);
        }
    }
    updateMediaSessionMetadata(image?: string) {
        const MediaMetadataCompat = android.support.v4.media.MediaMetadataCompat;
        const metadataBuilder = new MediaMetadataCompat.Builder();
        // metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher));
        //lock screen icon for pre lollipop
        // metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher));
        const playingInfo = this.playingInfo;
        metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, playingInfo.name);
        if (playingInfo.description) {
            metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, playingInfo.description);
        }
        // metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, $tc('app.name'));
        // metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, playingInfo.name);
        if (image || playingInfo.cover) {
            // metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, image || playingInfo.cover);
            const originalBitmap = ImageSource.fromFileSync(playingInfo.cover).android as android.graphics.Bitmap;
            const newBitmap = modifyBitmap(originalBitmap, createColorMatrix(accentColor));
            originalBitmap.finalize();
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, newBitmap);
        } else {
            const context = Utils.ad.getApplicationContext();
            const resources = context.getResources();
            const identifier = context.getResources().getIdentifier('ic_launcher', 'mipmap', context.getPackageName());
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, android.graphics.BitmapFactory.decodeResource(resources, identifier));
        }
        metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, playingInfo.duration);
        this.getMediaSessionCompat().setMetadata(metadataBuilder.build());
    }
    setMediaPlaybackState(state) {
        const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
        const playbackstateBuilder = new PlaybackStateCompat.Builder();
        if (state === PlaybackStateCompat.STATE_PLAYING) {
            playbackstateBuilder.setActions(PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_PAUSE);
        } else {
            playbackstateBuilder.setActions(PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_PLAY);
        }
        playbackstateBuilder.setState(state, this.storyHandler.playerCurrentTime, 1);
        this.getMediaSessionCompat().setPlaybackState(playbackstateBuilder.build());
    }
    hidePlayingNotification() {
        NotificationHelper.hideNotification(PLAYING_NOTIFICATION_ID);
        this.playingNotifBuilder = null;
    }
    playingNotifBuilder: androidx.core.app.NotificationCompat.Builder;
    showPlayingNotification() {
        // console.log('showPlayingNotification', new Error().stack);
        const context = Utils.ad.getApplicationContext();
        const builder = (this.playingNotifBuilder = NotificationHelper.getMediaNotification(context, this.getMediaSessionCompat()));
        if (builder === null) {
            return;
        }
        const MediaStyle = androidx.media.app.NotificationCompat.MediaStyle;
        const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
        const playingInfo = this.playingInfo;
        const actionsInCompactView = [];
        if (playingInfo.canPause) {
            actionsInCompactView.push(0);
            builder.addAction(ic_pause_id, 'Pause', com.akylas.juleverne.CustomMediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_PLAY_PAUSE));
        }
        if (playingInfo.canStop) {
            actionsInCompactView.push(1);
            builder.addAction(ic_stop_id, 'Stop', com.akylas.juleverne.CustomMediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_STOP));
        }
        builder.setStyle(new MediaStyle().setShowActionsInCompactView(actionsInCompactView).setMediaSession(this.getMediaSessionCompat().getSessionToken()));
        NotificationHelper.showNotification(PLAYING_NOTIFICATION_ID, builder);
    }
    showPausedNotification() {
        const context = Utils.ad.getApplicationContext();
        const builder = (this.playingNotifBuilder = NotificationHelper.getMediaNotification(context, this.getMediaSessionCompat()));
        if (builder === null) {
            return;
        }
        const MediaStyle = androidx.media.app.NotificationCompat.MediaStyle;
        const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;

        const playingInfo = this.playingInfo;
        const actionsInCompactView = [0];
        builder.addAction(ic_play_id, 'Play', com.akylas.juleverne.CustomMediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_PLAY_PAUSE));
        if (playingInfo.canStop) {
            actionsInCompactView.push(1);
            builder.addAction(ic_stop_id, 'Stop', com.akylas.juleverne.CustomMediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_STOP));
        }
        builder.setStyle(new MediaStyle().setShowActionsInCompactView(actionsInCompactView).setMediaSession(this.getMediaSessionCompat().getSessionToken()));
        NotificationHelper.showNotification(PLAYING_NOTIFICATION_ID, builder);
    }

    onPlayerStart(event) {
        this.playingState = 'play';
        this.playingInfo = event.data;
        if (this.playingInfo.showPlayBar !== true) {
            return;
        }
        try {
            const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
            this.updateMediaSessionMetadata();
            this.getMediaSessionCompat().setActive(true);
            this.setMediaPlaybackState(PlaybackStateCompat.STATE_PLAYING);
            DEV_LOG && console.log('onPlayerStart', JSON.stringify(event.data), this.playingState, JSON.stringify(this.playingInfo));
            this.showPlayingNotification();
        } catch (error) {
            console.error('onPlayerStart', error, error.stack);
        }
    }
    onPlayerState(event) {
        if (event.data !== this.playingState) {
            this.playingState = event.data;
            // this.playingInfo = this.bluetoothHandler.playingInfo;
            DEV_LOG && console.log('onPlayerState1', event.data, this.playingState, this.playingInfo);
            if (!this.playingInfo || this.playingInfo.showPlayBar !== true) {
                return;
            }
            // if (this.playingInfo && this.playingInfo.canPause) {
            const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
            if (this.playingState === 'play') {
                this.getMediaSessionCompat().setActive(true);
                this.setMediaPlaybackState(PlaybackStateCompat.STATE_PLAYING);
                this.showPlayingNotification();
            } else {
                this.setMediaPlaybackState(PlaybackStateCompat.STATE_PAUSED);
                this.showPausedNotification();
            }
            if (this.playingState === 'stopped') {
                this.hidePlayingNotification();
            }
            // }
        }
    }
    handleMediaIntent(intent: android.content.Intent) {
        const event = intent.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT) as android.view.KeyEvent;

        switch (event.getKeyCode()) {
            case android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: {
                if (this.playingState === 'play') {
                    this.storyHandler.pauseStory();
                } else {
                    this.storyHandler.resumeStory();
                }
                break;
            }
            case android.view.KeyEvent.KEYCODE_MEDIA_STOP:
                if (this.playingState !== 'stopped') {
                    this.storyHandler.stopPlayingLoop({ fade: true });
                }
        }
    }
    updateAlbumArt(image) {
        if (this.playingNotifBuilder) {
            this.playingNotifBuilder.setLargeIcon(ImageSource.fromFileSync(image).android);
            NotificationHelper.showNotification(PLAYING_NOTIFICATION_ID, this.playingNotifBuilder);
        }
    }
    onDrawImage(event) {
        // if (this.playingInfo && this.playingInfo.canPause !== false) {
        // this.updateAlbumArt(event.bitmap);
        // }
    }

    // updateMediaPosition(isPlaying: Boolean, currentPositionMs: number, speed: number) {
    //     const PlaybackStateCompat = android.support.v4.media.session.PlaybackStateCompat;
    //     const state =  (isPlaying)? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED
    //         const newState = PlaybackStateCompat.Builder()
    //                 .setActions(ACTION_SEEK_TO)
    //                 .setState(state, currentPositionMs, if (isPlaying) speed else 0f)
    //                 .build()

    //         if(
    //                 //pause -> play, play-> pause
    //                 stateCompat?.state != newState.state ||
    //                 //speed changed
    //                 stateCompat?.playbackSpeed != speed ||
    //                 //seek
    //                 timeDiffer(stateCompat, newState, 2000)
    //         ){
    //             stateCompat = newState
    //             mediaSession.setPlaybackState(stateCompat)
    //         }

    //     }
    // }
}
