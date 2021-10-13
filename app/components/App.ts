import { getFile, getJSON } from '@akylas/nativescript/http';
import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
import * as EInfo from '@nativescript-community/extendedinfo';
import Observable from '@nativescript-community/observable';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import { Drawer } from '@nativescript-community/ui-drawer';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Frame, NavigationEntry, Page, StackLayout, knownFolders } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { path } from '@nativescript/core/file-system';
import { Device, Screen } from '@nativescript/core/platform';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { GC } from '@nativescript/core/utils/utils';
import { compose } from '@nativescript/email';
import { Vibrate } from 'nativescript-vibrate';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import Tracks from '~/components/Tracks';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import { BLEConnectionEventData } from '~/handlers/BluetoothHandler';
import Track from '~/models/Track';
import { BgServiceErrorEvent } from '~/services/BgService.common';
import { versionCompare } from '~/utils';
import { login } from '~/utils/dialogs';
import { bboxify } from '~/utils/geo';
import { backgroundColor, textColor } from '~/variables';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';
import FirmwareUpdate from './FirmwareUpdate';
import Home from './Home';
import Leaflet from './Leaflet.vue';
import Map from './Map';
import Settings from './Settings';
import Images from './Images.vue';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
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
    Firmware = 'firmware',
    Settings = 'settings',
    Images = 'images',
    Tracks = 'tracks',
    Map = 'map',
    Leaflet = 'leaflet'
}

export const navigateUrlProperty = 'navigateUrl';

const mailRegexp =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

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
    textColor = textColor;
    $refs: AppRefs;
    cartoLicenseRegistered = false;
    backgroundColor = backgroundColor;
    protected routes: { [k: string]: { component: typeof Vue } } = {
        [ComponentIds.Activity]: {
            component: Home
        },
        [ComponentIds.Settings]: {
            component: Settings
        },
        [ComponentIds.Images]: {
            component: Images as any
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

    public glassesSerialNumber = null;
    public glassesVersion = null;
    public connectedGlasses: GlassesDevice = null;

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
                icon: 'mdi-cogs',
                url: ComponentIds.Settings,
                activated: false
            },
            {
                title: this.$t('images'),
                icon: 'mdi-image',
                url: ComponentIds.Images,
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
        console.log('onServiceStarted');
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
        const devDataImported = appSettings.getBoolean('devDataImported', false);
        // if (devDataImported) {
        //     return;
        // }
        console.log('importDevSessions');
        try {
            // this.showLoading({ text: this.$t('importing_data'), progress: 0 });
            const importData = knownFolders.currentApp().getFile('assets/data/map.geojson').readTextSync();
            const data = JSON.parse(importData);
            for (let index = 0; index < data.length; index++) {
                const d = data[index];
                const track = new Track(d.name || Date.now());
                Object.assign(track, d);
                const geojson = bboxify(track.geometry);
                track.geometry = geojson as any;
                // track.geometry = reader.readFeatureCollection(JSON.stringify(d.geometry));
                track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });
                await track.save();
                appSettings.setBoolean('devDataImported', true);
            }
        } catch (err) {
            this.showError(err);
        } finally {
            // this.hideLoading();
        }
    }

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
        if (!event.entry.resolvedPage) {
            return;
        }
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
    onGlassesDisconnected(e: BLEConnectionEventData) {
        this.connectedGlasses = null;
        this.glassesVersion = null;
        this.glassesSerialNumber = null;
        // if not manual disconnect we are going to try and reconnect

        this.$crashReportService.setExtra('glasses', null);
        if (this.devMode) {
            const vibrator = new Vibrate();
            vibrator.vibrate(2000);
        }
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        const glasses = (this.connectedGlasses = e.data as GlassesDevice);
        this.glassesVersion = glasses.firmwareVersion;
        this.glassesSerialNumber = glasses.serialNumber;
        this.updateSentryInfos();

        this.hideLoading();
    }
    updateSentryInfos() {
        const glasses = this.connectedGlasses;
        if (glasses) {
            this.$crashReportService.setExtra(
                'glasses',
                JSON.stringify({
                    name: glasses.localName,
                    uuid: glasses.UUID,
                    firmware: this.glassesVersion,
                    serial: this.glassesSerialNumber
                })
            );
        } else {
            this.$crashReportService.setExtra('glasses', null);
        }
    }
    onGlassesReconnecting() {
        this.showLoading(this.$t('connection_lost_reconnecting'));
    }
    onGlassesReconnectingFailed() {
        this.hideLoading();
    }
    onGlassesVersion(e) {
        this.glassesVersion = e.data;
        this.checkFirmwareUpdateOnline();
        this.updateSentryInfos();
    }
    onGlassesSerialNumber(e) {
        this.glassesSerialNumber = e.data;
        this.updateSentryInfos();
    }
    checkFirmwareUpdateOnline(beta?: boolean) {
        getJSON({
            url: `https://gitlab.com/api/v4/projects/9965259/repository/files/${beta ? 'beta' : 'latest'}.json/raw?ref=master`,
            method: 'GET',
            headers: {
                'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
            }
        })
            .then((response: any) => {
                // if (response.statusCode === 200) {
                // const content = response.content;
                const newVersion = response.version;
                const compareResult = versionCompare(newVersion, this.glassesVersion);

                if (compareResult > 0) {
                    confirm({
                        cancelable: !response.mandatory,
                        title: this.$t('firmware_update', newVersion),
                        message: response.mandatory ? this.$t('mandatory_firmware_update_available_desc') : this.$t('firmware_update_available_desc'),
                        okButtonText: this.$t('update'),
                        cancelButtonText: response.mandatory ? undefined : this.$t('cancel')
                    })
                        .then((result) => timeout(500).then(() => result)) // delay a bit for android. Too fast
                        .then((result) => {
                            if (result) {
                                this.showLoading(this.$t('downloading_update'));
                                const filePath = path.join(knownFolders.temp().path, `update_${newVersion}.img`);
                                const args = {
                                    url: response.url,
                                    method: 'GET',
                                    headers: {
                                        'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
                                    }
                                };
                                return getFile(args, filePath).then((response) => {
                                    this.hideLoading();
                                    this.navigateTo(FirmwareUpdate, { props: { firmwareFile: response } });
                                });
                            } else if (response.mandatory) {
                                // this.quitApp();
                            }
                        })
                        .catch(this.showError);
                }
            })
            .catch((error) => {
                console.error('Https.request error', error);
            });
    }
}
