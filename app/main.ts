// import {Trace} from '@nativescript/core/trace';
// import {CollectionViewTraceCategory} from '@nativescript-community/ui-collectionview';
// Trace.addCategories(Trace.categories.NativeLifecycle);
// Trace.addCategories(Trace.categories.Navigation);
// Trace.addCategories(Trace.categories.ViewHierarchy);
// Trace.enable();
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import { themer } from '@nativescript-community/ui-material-core';
import Vue from 'nativescript-vue';
import App from './components/App';
import CrashReportService from './services/CrashReportService';
import { primaryColor } from './variables';
// importing filters
import FiltersPlugin from './vue.filters';
import MixinsPlugin from './vue.mixins';
// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
import ViewsPlugin from './vue.views';
const crashReportService = new CrashReportService();
// start it as soon as possible
crashReportService.start();

Vue.prototype.$crashReportService = crashReportService;

// we need to use lat lon
setMapPosKeys('lat', 'lon');

Vue.use(MixinsPlugin);
Vue.use(ViewsPlugin);
Vue.use(FiltersPlugin);
Vue.use(PrototypePlugin);

// Prints Vue logs when --env.production is *NO T* set while building
Vue.config.silent = true;
Vue.config['debug'] = false;

function throwVueError(err) {
    crashReportService.showError(err);
}

Vue.config.errorHandler = (e, vm, info) => {
    if (e) {
        console.log('[Vue][Error]', `[${info}]`, e, e.stack);
        setTimeout(() => throwVueError(e), 0);
    }
};

Vue.config.warnHandler = function (msg, vm, trace) {
    console.warn('[Vue][Warn]', `[${msg}]`);
    // cwarn(msg, trace);
};
console.log('primaryColor', primaryColor);
if (global.isIOS) {
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}

themer.createShape('round', {
    cornerFamily: 'rounded' as any,
    cornerSize: {
        value: 0.5,
        unit: '%'
    }
});

new Vue({
    render: (h) => h(App)
}).$start();
