/// <reference path="./node_modules/@nativescript/types-android/lib/android-29.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios.d.ts" />
/// <reference path="./node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="./vue.shim.d.ts" />

declare module '*.vue' {
    import Vue from 'vue';
    export default Vue;
}
declare module '*.scss';

declare const GITLAB_TOKEN: string;
declare const TNS_ENV: string;
declare const DEV_LOG: boolean;
declare const TEST_LOGS: boolean;
declare const PRODUCTION: boolean;
declare const NO_CONSOLE: boolean;
declare const __FORCE_BUG_REPORT__: boolean;
declare const SENTRY_DSN: string;
declare const SENTRY_PREFIX: string;
declare const UPDATE_DATA_DEFAULT_URL: string;
declare const SUPPORTED_LOCALES: string[];
declare const __APP_ID__: string;
declare const __APP_VERSION__: string;
declare const __APP_BUILD_NUMBER__: string;
declare const ACTIVELOOK_INTERNAL_TOKEN: string;
declare const ACTIVELOOK_BETA_TOKEN: string;
// declare const process: { env: any };

// Augment the NodeJS global type with our own extensions

declare const gVars: {
    sentry: boolean;
};

declare namespace com {
    export namespace akylas {
        export namespace juleverne {
            class BgService extends globalAndroid.app.Service {}
            class BgServiceBinder extends globalAndroid.os.Binder {}
            class ActionReceiver extends globalAndroid.content.BroadcastReceiver {}
            class CustomMediaButtonReceiver extends androidx.media.session.MediaButtonReceiver {}
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}
