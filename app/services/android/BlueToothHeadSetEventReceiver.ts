const ACTION_BT_HEADSET_STATE_CHANGED = 'android.bluetooth.headset.action.STATE_CHANGED';
const STATE_CONNECTED = 0x00000002;
const STATE_DISCONNECTED = 0x00000000;
const EXTRA_STATE = 'android.bluetooth.headset.extra.STATE';
import { BgService, getInstance } from './BgService';

@NativeClass
@JavaProxy('com.akylas.juleverne.BlueToothHeadSetEventReceiver')
export class BlueToothHeadSetEventReceiver extends android.content.BroadcastReceiver {
    onReceive(context: android.content.Context, intent: android.content.Intent) {
        try {
            const action = intent.getAction();
            console.log('BlueToothHeadSetEventReceiver', 'onReceive', action);

            if (action === null) {
                return;
            }

            if (action === ACTION_BT_HEADSET_STATE_CHANGED) {
                const extraData = intent.getIntExtra(EXTRA_STATE, STATE_DISCONNECTED);
                if (extraData === STATE_CONNECTED) {
                    console.log('headset connected');
                } else if (extraData === STATE_DISCONNECTED) {
                    console.log('headset disconnected');
                }
            }
        } catch (e) {
            console.error('BlueToothHeadSetEventReceiver', e, e.stack);
        }
    }
}
