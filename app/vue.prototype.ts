import { Device, Screen } from '@nativescript/core/platform';
import App from '~/components/App';
import { BgService } from './services/BgService';
import { alert, confirm } from './utils/dialogs';
import VueType from 'nativescript-vue';
import { $t , $tc, $tt, $tu} from '~/helpers/locale';

const filters = (VueType.prototype.$filters = VueType['options'].filters);

const Plugin = {
    install(Vue: typeof VueType) {
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;
        let appComponent: App;
        Vue.prototype.$setAppComponent = function(comp: App) {
            appComponent = comp;
        };
        Vue.prototype.$getAppComponent = function() {
            return appComponent;
        };

        Vue.prototype.$t = $t;
        Vue.prototype.$tc = $tc;
        Vue.prototype.$tt = $tt;
        Vue.prototype.$tu = $tu;

        Vue.prototype.$alert = function(message) {
            return alert({
                okButtonText: $tc('ok'),
                message
            });
        };

        if (!PRODUCTION) {
            console.log('model', Device.model);
            console.log('os', Device.os);
            console.log('osVersion', Device.osVersion);
            console.log('manufacturer', Device.manufacturer);
            console.log('deviceType', Device.deviceType);
            console.log('widthPixels', Screen.mainScreen.widthPixels);
            console.log('heightPixels', Screen.mainScreen.heightPixels);
            console.log('widthDIPs', Screen.mainScreen.widthDIPs);
            console.log('heightDIPs', Screen.mainScreen.heightDIPs);
            console.log('scale', Screen.mainScreen.scale);
            console.log('ratio', Screen.mainScreen.heightDIPs / Screen.mainScreen.widthDIPs);
        }
    }
};

export default Plugin;
