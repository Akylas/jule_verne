import CrashReportService from './services/CrashReportService';
const crashReportService = new CrashReportService();
// start it as soon as possible
crashReportService.start();

import Vue from 'nativescript-vue';
Vue.prototype.$crashReportService = crashReportService;

// import {Trace} from '@nativescript/core/trace';
// import {CollectionViewTraceCategory} from '@nativescript-community/ui-collectionview';
// Trace.addCategories(Trace.categories.NativeLifecycle);
// Trace.addCategories(Trace.categories.Navigation);
// Trace.addCategories(Trace.categories.ViewHierarchy);
// Trace.enable();


import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
// we need to use lat lon
setMapPosKeys('lat', 'lon');

import MixinsPlugin from './vue.mixins';
Vue.use(MixinsPlugin);

import ViewsPlugin from './vue.views';
Vue.use(ViewsPlugin);

let drawerInstance: Drawer;
export function getDrawerInstance() {
    return drawerInstance;
}
export function setDrawerInstance(instance: Drawer) {
    drawerInstance = instance;
}

// importing filters
import FiltersPlugin from './vue.filters';
Vue.use(FiltersPlugin);

// adding to Vue prototype
import PrototypePlugin from './vue.prototype';
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

Vue.config.warnHandler = function(msg, vm, trace) {
    console.warn('[Vue][Warn]', `[${msg}]`);
    // cwarn(msg, trace);
};
import { primaryColor } from './variables';
import { themer } from '@nativescript-community/ui-material-core';
import App from './components/App';
import { Drawer } from '@nativescript-community/ui-drawer';
console.log('primaryColor', primaryColor);
if (global.isIOS) {
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}

new Vue({
    render: h => h(App)
}).$start();
