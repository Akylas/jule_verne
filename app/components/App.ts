import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
import * as EInfo from '@nativescript-community/extendedinfo';
import Observable from '@nativescript-community/observable';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import { Drawer } from '@nativescript-community/ui-drawer';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { Frame, NavigationEntry, Page, StackLayout, knownFolders } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { Device, Screen } from '@nativescript/core/platform';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { GC } from '@nativescript/core/utils/utils';
import { compose } from '@nativescript/email';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import Tracks from '~/components/Tracks';
import { GeoHandler } from '~/handlers/GeoHandler';
import Track from '~/models/Track';
import { BgServiceErrorEvent } from '~/services/BgService.common';
import { login } from '~/utils/dialogs';
import { bboxify } from '~/utils/geo';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';
import Home from './Home';
import Map from './Map';
import Settings from './Settings';
import Leaflet from './Leaflet.vue';

function base64Encode(value) {
    if (global.isIOS) {
        //@ts-ignore
        const text = NSString.stringWithString(value);
        //@ts-ignore
        const data = text.dataUsingEncoding(NSUTF8StringEncoding);
        return data.base64EncodedStringWithOptions(0);
    }
    if (global.isAndroid) {
        const text = new java.lang.String(value);
        const data = text.getBytes('UTF-8');
        return android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT);
    }
}

export interface AppRefs extends BaseVueComponentRefs {
    [key: string]: any;
    innerFrame: NativeScriptVue<Frame>;
    menu: NativeScriptVue<StackLayout>;
    drawer: Drawer;
}

export enum ComponentIds {
    Activity = 'activity',
    Settings = 'settings',
    Tracks = 'tracks',
    Map = 'map',
    Leaflet = 'leaflet'
}

export const navigateUrlProperty = 'navigateUrl';

const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

const production = TNS_ENV === 'production';

const observable = new Observable();
export const on = observable.on.bind(observable);
export const off = observable.off.bind(observable);
export const notify = observable.notify.bind(observable);

@Component({
    components: {
        Home
    }
})
export default class App extends BgServiceComponent {
    $refs: AppRefs;
    cartoLicenseRegistered = false;
    protected routes: { [k: string]: { component: typeof Vue } } = {
        [ComponentIds.Activity]: {
            component: Home
        },
        [ComponentIds.Settings]: {
            component: Settings
        },
        [ComponentIds.Tracks]: {
            component: Tracks
        },
        [ComponentIds.Map]: {
            component: Map
        },
        [ComponentIds.Leaflet]: {
            component: Leaflet as any
        }
    };
    public activatedUrl = '';
    public appVersion: string;
    public appPaused = false;
    get drawer() {
        return this.getRef<Drawer>('drawer');
    }
    get innerFrame() {
        return this.getRef<Frame>('innerFrame');
    }
    constructor() {
        super();
        this.bDevMode = appSettings.getBoolean('devMode', !production);
        this.$setAppComponent(this);
        this.appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
        this.$bgService.on(BgServiceErrorEvent, (event: any) => this.showError(event.error), this);
        handleOpenURL(this.onAppUrl);
    }

    async onAppUrl(data: AppURL) {
        this.log('Got the following appURL data', data, Array.from(data.params.entries()));
        try {
            if (data.path && data.path.endsWith('.gpx')) {
                this.showLoading(this.$t('importing'));
                await this.geoHandler.importGPXFile(data.path);
                console.log('resolving');
                this.hideLoading();
                this.$getAppComponent().navigateToUrl(ComponentIds.Tracks);
            } else if (data.path && data.path.endsWith('.json')) {
                this.showLoading(this.$t('importing'));
                await this.geoHandler.importJSONFile(data.path);
                console.log('resolving');
                this.hideLoading();
                this.$getAppComponent().navigateToUrl(ComponentIds.Tracks);
            }
        } catch (err) {
            this.showError(err);
        }
    }

    get menuItems() {
        const result = [
            {
                title: this.$t('tracks'),
                icon: 'mdi-map-marker-path',
                url: ComponentIds.Tracks,
                activated: false
            },
            // {
            //     title: this.$t('create_track'),
            //     icon: 'mdi-map-marker-distance',
            //     url: ComponentIds.Leaflet,
            //     activated: false
            // },
            {
                title: this.$t('settings'),
                icon: 'mdi-settings',
                url: ComponentIds.Settings,
                activated: false
            }
        ];

        result.forEach((m) => {
            if (m.url === this.activatedUrl) {
                m.activated = true;
            }
        });
        return result;
    }

    needsImportOldSessionsOnLoaded = false;
    onServiceStarted() {
        if (this.needsImportOldSessionsOnLoaded) {
            this.needsImportOldSessionsOnLoaded = false;
            this.importDevSessions();
        }
    }
    onLoaded() {
        GC();
        if (this.dbHandler && this.dbHandler.started) {
            this.importDevSessions();
        } else {
            this.needsImportOldSessionsOnLoaded = true;
        }
    }
    async importDevSessions() {
        if (DEV_LOG) {
            console.log('importDevSessions');
            try {
                this.showLoading({ text: this.$t('importing_data'), progress: 0 });
                const importData = knownFolders.currentApp().getFile('assets/test_data.json').readTextSync();
                const data = JSON.parse(importData);
                for (let index = 0; index < data.length; index++) {
                    const d = data[index];
                    const track = new Track(d.name || Date.now());
                    Object.assign(track, d);
                    const geojson = bboxify(track.geometry);
                    track.geometry = geojson as any;
                    console.log('geojson', geojson.bbox);
                    // track.geometry = reader.readFeatureCollection(JSON.stringify(d.geometry));
                    track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });
                    await track.save();
                }
            } catch (err) {
                this.showError(err);
            } finally {
                this.hideLoading();
            }
        }
    }

    updateSentryInfos() {}

    quitApp() {
        this.$bgService.stop().then(() => {
            if (global.isIOS) {
                //@ts-ignore
                exit(0);
            } else {
                app.android.startActivity.finish();
            }
        });
    }

    onServiceLoaded(handlers: BgServiceMethodParams) {
        handlers.dbHandler.devMode = this.bDevMode;
    }
    destroyed() {
        super.destroyed();
    }
    mounted(): void {
        super.mounted();
        // we need to set it again, it seems it is not the same instance in the constructor :s
        this.$setAppComponent(this);

        if (global.isIOS && app.ios.window.safeAreaInsets) {
            const bottomSafeArea: number = app.ios.window.safeAreaInsets.bottom;
            if (bottomSafeArea > 0) {
                app.addCss(`
                  Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
              `);
            }
        }
        this.innerFrame.on(Page.navigatingToEvent, this.onPageNavigation, this);
    }
    onPageNavigation(event) {
        this.navigating = false;
        this.closeDrawer();
        this.setActivatedUrl(event.entry.resolvedPage[navigateUrlProperty]);
    }

    isComponentSelected(url: string) {
        return this.activatedUrl === url;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
    onCloseDrawerTap() {
        this.closeDrawer();
    }

    onMenuIcon() {
        const canGoBack = this.canGoBack();
        if (canGoBack) {
            return this.navigateBack();
        } else {
            this.drawer.toggle();
        }
    }
    canGoBack() {
        return this.innerFrame && this.innerFrame.canGoBack();
    }

    isActiveUrl(id: ComponentIds) {
        return this.activatedUrl === id;
    }

    // @log
    setActivatedUrl(id) {
        if (!id || id === this.activatedUrl) {
            return;
        }
        this.activatedUrl = id;
    }
    navigateBack(backEntry?) {
        this.innerFrame && this.innerFrame.goBack(backEntry);
    }
    findNavigationUrlIndex(url) {
        return this.innerFrame.backStack.findIndex((b) => b.resolvedPage[navigateUrlProperty] === url);
    }
    navigateBackIfUrl(url) {
        if (this.isActiveUrl(url)) {
            this.navigateBack();
        }
    }

    navigateBackToUrl(url) {
        const index = this.findNavigationUrlIndex(url);
        if (index === -1) {
            console.log(url, 'not in backstack');
            return;
        }
        this.navigateBack(this.innerFrame.backStack[index]);
    }
    navigateBackToRoot() {
        const stack = this.innerFrame.backStack;
        if (stack.length > 0) {
            this.innerFrame && this.innerFrame.goBack(stack[0]);
        }
    }

    onNavItemTap(url: string, comp?: any): void {
        this.closeDrawer();
        this.navigateToUrl(url as any);
    }
    onTap(command: string) {
        switch (command) {
            case 'sendFeedback':
                compose({
                    subject: `[${EInfo.getAppNameSync()}(${this.appVersion})] Feedback`,
                    to: ['contact@akylas.fr'],
                    attachments: [
                        {
                            fileName: 'report.json',
                            path: `base64://${base64Encode(
                                JSON.stringify(
                                    {
                                        device: {
                                            model: Device.model,
                                            deviceType: Device.deviceType,
                                            language: Device.language,
                                            manufacturer: Device.manufacturer,
                                            os: Device.os,
                                            osVersion: Device.osVersion,
                                            region: Device.region,
                                            sdkVersion: Device.sdkVersion,
                                            uuid: Device.uuid
                                        },
                                        screen: {
                                            widthDIPs: Screen.mainScreen.widthDIPs,
                                            heightDIPs: Screen.mainScreen.heightDIPs,
                                            widthPixels: Screen.mainScreen.widthPixels,
                                            heightPixels: Screen.mainScreen.heightPixels,
                                            scale: Screen.mainScreen.scale
                                        }
                                    },
                                    null,
                                    4
                                )
                            )}`,
                            mimeType: 'application/json'
                        }
                    ]
                }).catch(this.showError);
                break;
            case 'sendBugReport':
                login({
                    title: this.$tc('send_bug_report'),
                    message: this.$tc('send_bug_report_desc'),
                    okButtonText: this.$t('send'),
                    cancelButtonText: this.$t('cancel'),
                    autoFocus: true,
                    usernameTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        autocapitalizationType: 'none',
                        keyboardType: 'email',
                        autocorrect: false,
                        error: this.$tc('email_required'),
                        hint: this.$tc('email')
                    },
                    passwordTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        error: this.$tc('please_describe_error'),
                        secure: false,
                        hint: this.$tc('description')
                    },
                    beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                        usernameTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                usernameTextField.error = this.$tc('email_required');
                            } else if (!mailRegexp.test(text)) {
                                usernameTextField.error = this.$tc('non_valid_email');
                            } else {
                                usernameTextField.error = null;
                            }
                        });
                        passwordTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                passwordTextField.error = this.$tc('description_required');
                            } else {
                                passwordTextField.error = null;
                            }
                        });
                    }
                }).then((result) => {
                    if (result.result) {
                        if (!result.userName || !mailRegexp.test(result.userName)) {
                            this.showError(new Error(this.$tc('email_required')));
                            return;
                        }
                        if (!result.password || result.password.length === 0) {
                            this.showError(new Error(this.$tc('description_required')));
                            return;
                        }
                        this.$crashReportService.withScope((scope) => {
                            scope.setUser({ email: result.userName });
                            this.$crashReportService.captureMessage(result.password);
                            this.$alert(this.$t('bug_report_sent'));
                        });
                    }
                });
                break;
        }
    }
    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || this.innerFrame.id;
        return super.navigateTo(component, options, cb);
    }
    navigating = false;
    navigateToUrl(url: ComponentIds, options?: NavigationEntry & { props?: any }, cb?: () => Page) {
        if (this.isActiveUrl(url) || !this.routes[url] || this.navigating) {
            return;
        }
        this.navigating = true;
        const index = this.findNavigationUrlIndex(url);
        if (index === -1) {
            this.navigateTo(this.routes[url].component, options);
        } else {
            this.navigateBackToUrl(url);
        }
    }
    bDevMode = true;

    get devMode() {
        return this.bDevMode;
    }
    set devMode(value) {
        this.bDevMode = value;
        if (this.dbHandler) {
            this.dbHandler.devMode = value;
        }
        appSettings.setBoolean('devMode', value);
    }
    switchDevMode(args: GestureEventData) {
        if (args && args.ios && args.ios.state !== 3) {
            return;
        }
        this.devMode = !this.devMode;

        showSnack({ message: `devmode:${this.devMode}` });
    }
}
