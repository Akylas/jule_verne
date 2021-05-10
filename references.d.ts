/// <reference path="./node_modules/@nativescript/types-android/lib/android-29.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios.d.ts" />
/// <reference path="./node_modules/@nativescript/core/global-types.d.ts" />
/// <reference path="./vue.shim.d.ts" />

declare module '*.vue' {
    import Vue from 'vue';
    export default Vue;
}
declare module '*.scss';

declare const TNS_ENV: string;
declare const DEV_LOG: boolean;
declare const TEST_LOGS: boolean;
declare const PRODUCTION: boolean;
declare const NO_CONSOLE: boolean;
declare const SENTRY_DSN: string;
declare const SENTRY_PREFIX: string;
declare const SUPPORTED_LOCALES: string[];
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
        }
    }
}

interface LatLonKeys {
    lat: number;
    lon: number;
    altitude?: number;
}
