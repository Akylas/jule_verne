// import { Trace } from '@nativescript/core/trace';
// import { ImageViewTraceCategory } from '@nativescript-community/ui-image';
// import {CollectionViewTraceCategory} from '@nativescript-community/ui-collectionview';
// import {BleTraceCategory} from '@nativescript-community/ble';
// import { PermsTraceCategory } from '@nativescript-community/perms';
// Trace.addCategories(Trace.categories.NativeLifecycle);
// Trace.addCategories(BleTraceCategory);
// Trace.addCategories(PermsTraceCategory);
// Trace.addCategories(Trace.categories.Navigation);
// Trace.addCategories(Trace.categories.Transition);
// Trace.addCategories(ImageViewTraceCategory);
// Trace.enable();
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import { themer } from '@nativescript-community/ui-material-core';
import { time } from '@nativescript/core/profiling';
import Vue from 'nativescript-vue';
import App from '~/components/App.vue';
import CrashReportService from '~/services/CrashReportService';
import { primaryColor } from '~/variables';
// importing filters
import FiltersPlugin from '~/vue.filters';
import MixinsPlugin from '~/vue.mixins';
import PrototypePlugin from '~/vue.prototype';
import ViewsPlugin from '~/vue.views';


// For addiTween
if (!global.window) {
    window = global.window = {
        requestAnimationFrame,
        cancelAnimationFrame,
        performance: {
            now: time
        } as any
    } as any;
} else if (!global.window.requestAnimationFrame) {
    global.window.requestAnimationFrame = requestAnimationFrame;
    global.window.cancelAnimationFrame = cancelAnimationFrame;
    if (!global.window.performance) {
        global.window.performance = {
            now: time
        } as any;
    }
}

if (__ANDROID__) {
    (global as any).setInterval = (handler, timeout, ...args) => {
        timeout += 0;
        const invoke = () => handler(...args);
        const zoneBound = zonedCallback(invoke);
        return (global as any).__setInterval(() => {
            zoneBound();
        }, timeout || 0);
    };
    (global as any).clearInterval = (global as any).__clearInterval;
    (global as any).setTimeout = (handler, timeout, ...args) => {
        timeout += 0;
        const invoke = () => handler(...args);
        const zoneBound = zonedCallback(invoke);
        return (global as any).__setTimeout(() => {
            zoneBound();
        }, timeout || 0);
    };

    (global as any).clearTimeout = (global as any).__clearTimeout;
}

// if (__ANDROID__) {
//     (global as any).setInterval = (handler, timeout, ...args) => {
//         timeout += 0;
//         const invoke = () => handler(...args);
//         const zoneBound = zonedCallback(invoke);
//         return (global as any).__setInterval(() => {
//             zoneBound();
//         }, timeout || 0);
//     };
//     (global as any).clearInterval = (global as any).__clearInterval;
//     (global as any).setTimeout = (handler, timeout, ...args) => {
//         timeout += 0;
//         const invoke = () => handler(...args);
//         const zoneBound = zonedCallback(invoke);
//         return (global as any).__setTimeout(() => {
//             zoneBound();
//         }, timeout || 0);
//     };

//     (global as any).clearTimeout = (global as any).__clearTimeout;
// }
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
if (__IOS__) {
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}

themer.createShape('round', {
    cornerFamily: 'rounded' as any,
    cornerSize: {
        value: 50,
        unit: '%'
    }
});

themer.createShape('default', {
    cornerFamily: 'rounded' as any,
    cornerSize: {
        value: 10,
        unit: 'dip'
    }
});

new Vue({
    render: (h) => h(App)
}).$start();
