import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
import * as EInfo from '@nativescript-community/extendedinfo';
import { HttpsRequestOptions, cancelRequest, request, setCache } from '@nativescript-community/https';
import Observable from '@nativescript-community/observable';
import { MapBounds } from '@nativescript-community/ui-carto/core';
import { Drawer } from '@nativescript-community/ui-drawer';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ApplicationSettings, File, Frame, NavigationEntry, ObservableArray, Page, StackLayout, knownFolders } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import * as appSettings from '@nativescript/core/application-settings';
import { Folder, path } from '@nativescript/core/file-system';
import { Device, Screen } from '@nativescript/core/platform';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { compose } from '@nativescript/email';
import { Vibrate } from 'nativescript-vibrate';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Component } from 'vue-property-decorator';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import { BLEConnectionEventData } from '~/handlers/BluetoothHandler';
import { BgServiceErrorEvent } from '~/services/BgService.common';
import { versionCompare } from '~/utils';
import { bboxify } from '~/utils/geo';
import { getWorkingDir, throttle } from '~/utils/utils';
import { backgroundColor, textColor } from '~/variables';
import { BaseVueComponentRefs } from './BaseVueComponent';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';
import Home from './Home';
import { Zip } from '@nativescript/zip';
import { $tc } from '~/helpers/locale';
import fileSize from 'filesize';
import { date } from '~/vue.filters';

const folder = knownFolders.temp().getFolder('cache');
const diskLocation = folder.path;
const cacheSize = 10 * 1024 * 1024;
setCache({
    forceCache: !PRODUCTION,
    diskLocation,
    diskSize: cacheSize,
    memorySize: cacheSize
});

export function getJSON<T>(arg: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg).then(
            (r) => {
                try {
                    const json = r.content.toJSON();
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            },
            (e) => reject(e)
        );
    });
}

export async function getHEAD<T>(arg: any) {
    return (await request<T>(typeof arg === 'string' ? { url: arg, method: 'HEAD' } : arg)).headers;
}

export async function getFile(arg: string | HttpsRequestOptions, destinationFilePath?: string) {
    return (await request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg)).content.toFile(destinationFilePath);
}

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function base64Encode(value) {
    if (__IOS__) {
        //@ts-ignore
        const text = NSString.stringWithString(value);
        //@ts-ignore
        const data = text.dataUsingEncoding(NSUTF8StringEncoding);
        return data.base64EncodedStringWithOptions(0);
    }
    if (__ANDROID__) {
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
    Images = 'images',
    Firmware = 'firmware',
    Map = 'map'
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
    date = date;
    textColor = textColor;
    $refs: AppRefs;
    cartoLicenseRegistered = false;
    backgroundColor = backgroundColor;
    protected routes: { [k: string]: { component: typeof Vue } } = {
        [ComponentIds.Activity]: {
            component: Home
        }
    };
    public activatedUrl = '';
    public appVersion: string;
    public appPaused = false;

    public glassesSerialNumber = null;
    public glassesVersion = null;
    public connectedGlasses: GlassesDevice = null;

    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);

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
        // console.log('Got the following appURL data', data, Array.from(data.params.entries()));
        try {
            // if (data.path && data.path.endsWith('.gpx')) {
            //     this.showLoading(this.$t('importing'));
            //     await this.geoHandler.importGPXFile(data.path);
            //     console.log('resolving');
            //     this.hideLoading();
            //     const component = await import('~/components/Tracks');
            //     this.$getAppComponent().navigateTo(component.default);
            // } else
            if (data.path && data.path.endsWith('.json')) {
                this.showLoading(this.$t('importing'));
                await this.geoHandler.importJSONFile(data.path);
                this.hideLoading();
                const component = await import('~/components/Tracks');
                this.$getAppComponent().navigateTo(component.default);
            }
        } catch (err) {
            this.showError(err);
        }
    }

    menuItems = new ObservableArray([
        {
            title: this.$t('map'),
            icon: 'mdi-map',
            component: async () => (await import('~/components/Home')).default,
            url: ComponentIds.Activity,
            activated: false
        },
        {
            title: this.$t('tracks'),
            icon: 'mdi-map-marker-path',
            component: async () => (await import('~/components/Tracks')).default,
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
            component: async () => (await import('~/components/Settings')).default,
            url: ComponentIds.Settings,
            activated: false
        },
        {
            title: this.$t('images'),
            icon: 'mdi-image',
            component: async () => (await import('~/components/Images.vue')).default,
            url: ComponentIds.Images,
            activated: false
        }
    ]);

    needsImportOldSessionsOnLoaded = false;

    onNavigatedTo() {
        console.log('onNavigatedTo', this.needsImportOldSessionsOnLoaded);
        // if (this.dbHandler && this.dbHandler.started) {
        //     this.importDevSessions();
        // } else {
        //     this.needsImportOldSessionsOnLoaded = true;
        // }
    }
    onServiceStarted() {
        // console.log('onServiceStarted', this.needsImportOldSessionsOnLoaded);
        if (this.needsImportOldSessionsOnLoaded) {
            this.needsImportOldSessionsOnLoaded = false;
            this.importDevSessions();
        }
    }
    onLoaded() {
        // GC();
        // console.log('onLoaded', this.needsImportOldSessionsOnLoaded);
        if (this.dbHandler && this.dbHandler.started) {
            this.importDevSessions();
        } else {
            this.needsImportOldSessionsOnLoaded = true;
        }
        this.checkForGlassesDataUpdate().then(() => {
            this.checkForMapDataUpdate();
        });
    }
    async importDevSessions() {
        try {
            let geojsonPath = path.join(getWorkingDir(), 'map.geojson');
            await this.checkForGeoJSONUpdate(geojsonPath);
            console.log('importDevSessions', geojsonPath, File.exists(geojsonPath));
            if (!File.exists(geojsonPath)) {
                geojsonPath = path.join(knownFolders.currentApp().path, 'assets/data/map.geojson');
            }
            // this.showLoading({ text: this.$t('importing_data'), progress: 0 });
            const file = File.fromPath(geojsonPath);
            const lastChecked = ApplicationSettings.getNumber('map.geojson_date', 0);
            console.log('importDevSessions', lastChecked, file.lastModified.getTime());
            if (file.lastModified.getTime() <= lastChecked) {
                return;
            }
            const importData = file.readTextSync();
            const data = JSON.parse(importData);
            const existing = (await this.dbHandler.trackRepository.searchItem()).map((t) => t.id);
            for (let index = 0; index < data.length; index++) {
                const d = data[index];
                const track = { ...d, id: (d.name || Date.now()) + '' };
                const geojson = bboxify(track.geometry);
                track.geometry = geojson as any;
                // track.geometry = reader.readFeatureCollection(JSON.stringify(d.geometry));
                track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });
                if (existing.indexOf(track.id) === -1) {
                    await this.dbHandler.trackRepository.createItem(track);
                } else {
                    await this.dbHandler.trackRepository.updateItem(track);
                }
            }
            appSettings.setNumber('map.geojson_date', file.lastModified.getTime());
        } catch (err) {
            this.showError(err);
        } finally {
            // this.hideLoading();
        }
    }

    quitApp() {
        this.$bgService.stop().then(() => {
            if (__IOS__) {
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

        if (__IOS__ && app.ios.window.safeAreaInsets) {
            const bottomSafeArea: number = app.ios.window.safeAreaInsets.bottom;
            if (bottomSafeArea > 0) {
                app.addCss(`
                  Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
              `);
            }
        }
        this.innerFrame.on(Page.navigatedToEvent, this.onPageNavigation, this);
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

    setActivatedUrl(id) {
        if (!id || id === this.activatedUrl) {
            return;
        }
        const oldActiveUrl = this.activatedUrl;
        this.activatedUrl = id;
        if (oldActiveUrl) {
            const index = this.menuItems.findIndex((d) => d.url === oldActiveUrl);
            if (index !== -1) {
                const item = this.menuItems.getItem(index);
                item.activated = false;
                this.menuItems.setItem(index, item);
            }
        }
        if (this.activatedUrl) {
            const index = this.menuItems.findIndex((d) => d.url === this.activatedUrl);
            if (index !== -1) {
                const item = this.menuItems.getItem(index);
                item.activated = true;
                this.menuItems.setItem(index, item);
            }
        }
    }
    navigateBack(backEntry?) {
        return this.innerFrame && this.innerFrame.goBack(backEntry);
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
        return this.navigateBack(this.innerFrame.backStack[index]);
    }
    navigateBackToRoot() {
        const stack = this.innerFrame.backStack;
        if (stack.length > 0) {
            this.innerFrame && this.innerFrame.goBack(stack[0]);
        }
    }

    async onNavItemTap(item) {
        let component = item.component;
        if (typeof component === 'function') {
            component = await (component as () => Promise<VueConstructor>)();
        }
        try {
            this.navigateToUrl(item.url, { component });
        } catch (error) {
            this.showError(error);
        }
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
    async navigateToUrl(url: ComponentIds, options?: NavigationEntry & { props?: any; component?: VueConstructor }, cb?: () => Page) {
        if (this.isActiveUrl(url) || this.navigating) {
            this.closeDrawer();
            return;
        }
        this.navigating = true;
        const index = this.findNavigationUrlIndex(url);
        if (index === -1) {
            const component = options.component || this.routes[url].component;

            return this.navigateTo(component, options);
        } else {
            return this.navigateBackToUrl(url);
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
                                return getFile(
                                    {
                                        url: response.url,
                                        method: 'GET',
                                        headers: {
                                            'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
                                        }
                                    },
                                    filePath
                                ).then(async (response) => {
                                    this.hideLoading();
                                    const component = await import('~/components/FirmwareUpdate');
                                    this.navigateTo(component.default, { props: { firmwareFile: response } });
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
    checkConfigUpdateOnline(beta?: boolean) {
        getJSON({
            url: `https://gitlab.com/api/v4/projects/20247090/repository/files/${beta ? 'beta' : 'latest'}.json/raw?ref=master`,
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
                                const filePath = path.join(knownFolders.temp().path, `config_update_${newVersion}.txt`);
                                return getFile(
                                    {
                                        url: response.url,
                                        method: 'GET',
                                        headers: {
                                            'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
                                        }
                                    },
                                    filePath
                                ).then(async (response) => {
                                    this.hideLoading();
                                    // const component = await import('~/components/FirmwareUpdate');
                                    // this.navigateTo(component.default, { props: { firmwareFile: response } });
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
    async checkForGlassesDataUpdate() {
        try {
            const url = ApplicationSettings.getString('GLASSES_DATA_DEFAULT_URL', GLASSES_DATA_DEFAULT_URL);
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('GLASSES_DATA_SIZE', '');
            console.log(url, lastSize, headers);
            if (lastSize !== headers['content-length']) {
                const requestTag = Date.now() + '';
                this.showLoading({
                    title: $tc('downloading_glasses_update'),
                    text: ' ',
                    progress: 0,
                    onButtonTap: () => cancelRequest(requestTag)
                });
                const filePath = path.join(knownFolders.temp().path, 'glasses_images.zip');
                const onProgress = throttle((current, total) => {
                    const perc = Math.round((current / total) * 100);
                    this.updateLoadingProgress({
                        text: `${fileSize(current)}/${fileSize(total)} (${perc}%)`,
                        progress: perc
                    });
                }, 1000);
                const file = await getFile(
                    {
                        url,
                        tag: requestTag,
                        method: 'GET',
                        onProgress
                    },
                    filePath
                );
                this.updateLoadingProgress({
                    text: $tc('uncompress_glasses_data'),
                    progress: 0
                });
                await Zip.unzip({
                    archive: file.path,
                    directory: getWorkingDir(),
                    overwrite: true,
                    onProgress: (percent) => {
                        this.updateLoadingProgress({
                            text: `${Math.round(percent)}%`,
                            progress: percent
                        });
                    }
                });
                this.glassesDataUpdateDate = Date.now();
                ApplicationSettings.setNumber('GLASSES_DATA_LASTDATE', this.glassesDataUpdateDate);
                ApplicationSettings.setString('GLASSES_DATA_SIZE', headers['content-length'] as string);
            }
        } catch (error) {
            console.error(error);
        } finally {
            this.hideLoading();
        }
    }
    async checkForMapDataUpdate() {
        try {
            const url = ApplicationSettings.getString('MAP_DATA_DEFAULT_URL', MAP_DATA_DEFAULT_URL);
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('MAP_DATA_SIZE', '');
            console.log(url, lastSize, headers);
            if (lastSize !== headers['content-length'] || !Folder.exists(path.join(getWorkingDir(), 'tiles'))) {
                const requestTag = Date.now() + '';
                this.showLoading({
                    title: $tc('downloading_map_update'),
                    text: ' ',
                    progress: 0,
                    onButtonTap: () => cancelRequest(requestTag)
                });
                const filePath = path.join(knownFolders.temp().path, 'tiles.zip');
                const onProgress = throttle((current, total) => {
                    const perc = Math.round((current / total) * 100);
                    this.updateLoadingProgress({
                        text: `${fileSize(current)}/${fileSize(total)} (${perc}%)`,
                        progress: perc
                    });
                }, 1000);
                const file = await getFile(
                    {
                        url,
                        tag: requestTag,
                        method: 'GET',
                        onProgress
                    },
                    filePath
                );
                this.updateLoadingProgress({
                    text: $tc('uncompress_map_data'),
                    progress: 0
                });
                await Zip.unzip({
                    archive: file.path,
                    directory: getWorkingDir(),
                    overwrite: true,
                    onProgress: (percent) => {
                        this.updateLoadingProgress({
                            text: `${Math.round(percent)}%`,
                            progress: percent
                        });
                    }
                });
                this.mapDataUpdateDate = Date.now();
                ApplicationSettings.setString('MAP_DATA_SIZE', headers['content-length'] as string);
                ApplicationSettings.setNumber('MAP_DATA_LASTDATE', this.mapDataUpdateDate);
            }
        } catch (error) {
            console.error(error);
        } finally {
            this.hideLoading();
        }
    }
    async checkForGeoJSONUpdate(geojsonPath: string) {
        try {
            const url = ApplicationSettings.getString('GEOJSON_DATA_DEFAULT_URL', GEOJSON_DATA_DEFAULT_URL);
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('GEOJSON_DATA_SIZE', '');
            console.log('checkForGeoJSONUpdate', url, lastSize, headers);
            if (lastSize !== headers['content-length']) {
                await getFile(
                    {
                        url,
                        method: 'GET'
                    },
                    geojsonPath
                );

                this.geojsonDataUpdateDate = Date.now();
                ApplicationSettings.setString('GEOJSON_DATA_SIZE', headers['content-length'] as string);
                ApplicationSettings.setNumber('GEOJSON_DATA_LASTDATE', this.geojsonDataUpdateDate);
            }
        } catch (error) {
            console.error(error);
        }
    }
}
