import { BgService, getInstance } from './BgService';

@NativeClass
@JavaProxy('com.akylas.juleverne.CustomMediaButtonReceiver')
export class CustomMediaButtonReceiver extends androidx.media.session.MediaButtonReceiver {
    onReceive(context: android.content.Context, intent: android.content.Intent) {
        try {
            console.error('CustomMediaButtonReceiver', intent.getAction());
            if (intent.getAction() !== 'android.intent.action.MEDIA_BUTTON') {
                return;
            }
            getInstance().handleMediaIntent(intent);
        } catch (e) {
            console.error('CustomMediaButtonReceiver', e, e.stack);
        }
    }
}
