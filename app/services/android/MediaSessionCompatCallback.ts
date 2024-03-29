const TAG = 'MediaSessionCompatCallback';

@NativeClass
export class MediaSessionCompatCallback extends android.support.v4.media.session.MediaSessionCompat.Callback {
    constructor(private impl) {
        super();
        return global.__native(this);
    }

    onPlay() {
        super.onPlay();
    }
    onPause() {
        super.onPause();
    }

    onSkipToNext() {
        super.onSkipToNext();
    }

    onSkipToPrevious() {
        super.onSkipToPrevious();
    }
    onPlayFromMediaId(mediaId, extras) {
        super.onPlayFromMediaId(mediaId, extras);
    }
    onCommand(command, extras, cb) {
        super.onCommand(command, extras, cb);
    }
    onSeekTo(pos) {
        super.onSeekTo(pos);
    }
    onMediaButtonEvent(mediaButtonIntent) {
        const action = mediaButtonIntent.getAction();
        if (android.content.Intent.ACTION_MEDIA_BUTTON === mediaButtonIntent.getAction()) {
            const event = mediaButtonIntent.getParcelableExtra(android.content.Intent.EXTRA_KEY_EVENT);
            return true;
        }
        return super.onMediaButtonEvent(mediaButtonIntent);
    }
}
