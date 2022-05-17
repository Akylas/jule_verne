const TAG = 'MediaSessionCompatCallback';

@NativeClass
export class MediaSessionCompatCallback extends android.support.v4.media.session.MediaSessionCompat.Callback {
    constructor(private impl) {
        super();
        return global.__native(this);
    }

    onPlay() {
        console.log(TAG, 'onPlay');
        super.onPlay();
    }
    onPause() {
        console.log(TAG, 'onPause');
        super.onPause();
    }

    onSkipToNext() {
        console.log(TAG, 'onSkipToNext');
        super.onSkipToNext();
    }

    onSkipToPrevious() {
        console.log(TAG, 'onSkipToPrevious');
        super.onSkipToPrevious();
    }
    onPlayFromMediaId(mediaId, extras) {
        console.log(TAG, 'onPlayFromMediaId');
        super.onPlayFromMediaId(mediaId, extras);
    }
    onCommand(command, extras, cb) {
        console.log(TAG, 'onCommand');
        super.onCommand(command, extras, cb);
    }
    onSeekTo(pos) {
        console.log(TAG, 'onSeekTo');
        super.onSeekTo(pos);
    }
    onMediaButtonEvent(mediaButtonIntent) {
        const action = mediaButtonIntent.getAction();
        console.log('MediaSession', 'Intent Action' + action);
        if (android.content.Intent.ACTION_MEDIA_BUTTON === mediaButtonIntent.getAction()) {
            const event = mediaButtonIntent.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT);
            console.log('MediaSession', 'KeyCode' + event.getKeyCode());
            return true;
        }
        return super.onMediaButtonEvent(mediaButtonIntent);
    }
}
