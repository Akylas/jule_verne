import { HttpsRequestOptions, cancelRequest, request, setCache } from '@nativescript-community/https';
import { AlertDialog, confirm } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ApplicationSettings, Device, File, Frame, GestureEventData, NavigationEntry, Page, Screen, knownFolders, path } from '@nativescript/core';
import { setBoolean } from '@nativescript/core/application-settings';
import { Folder } from '@nativescript/core/file-system';
import { Zip } from '@nativescript/zip';
import fileSize from 'filesize';
import VueType, { VueConstructor } from 'vue';
import { $t, $tc, $tt, $tu } from '~/helpers/locale';
import { notify as appNotify, hashCode, timeout, versionCompare } from '~/utils';
import { getWorkingDir, throttle } from '~/utils/utils';
import Home from '~/components/Home';
import LoadingIndicator from '~/components/LoadingIndicator.vue';
import { BgService } from '~/services/BgService';
import { alert } from '~/utils/dialogs';
import * as ProgressNotification from '~/utils/progress-notifications';

const filters = (VueType.prototype.$filters = VueType['options'].filters);

export async function getJSON<T>(arg: any): Promise<T> {
    return (await request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg)).content.toJSON();
}

export async function getHEAD<T>(arg: any) {
    return (await request<T>(typeof arg === 'string' ? { url: arg, method: 'HEAD' } : arg)).headers;
}

export async function getFile(arg: string | HttpsRequestOptions, destinationFilePath?: string) {
    return (await request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg)).content.toFile(destinationFilePath);
}

export interface ShowLoadingOptions {
    title?: string;
    text: string;
    progress?: number;
    onButtonTap?: () => void;
}
export interface LoadingIndicatorExtended extends LoadingIndicator {
    showButton: boolean;
    title: string;
    text: string;
    progress: number;
}
export const navigateUrlProperty = 'navigateUrl';
export enum ComponentIds {
    Activity = 'activity',
    Settings = 'settings',
    Tracks = 'tracks',
    Images = 'images',
    Firmware = 'firmware',
    Map = 'map'
}
const Plugin = {
    install(Vue: typeof VueType) {
        const folder = knownFolders.temp().getFolder('cache');
        const diskLocation = folder.path;
        const cacheSize = 10 * 1024 * 1024;
        setCache({
            forceCache: !PRODUCTION,
            diskLocation,
            diskSize: cacheSize,
            memorySize: cacheSize
        });
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;

        Vue.prototype.$t = $t;
        Vue.prototype.$tc = $tc;
        Vue.prototype.$tt = $tt;
        Vue.prototype.$tu = $tu;

        Vue.prototype.$alert = function (message) {
            return alert({
                okButtonText: $tc('ok'),
                message
            });
        };

        let navigating = false;
        const routes: { [k: string]: { component: typeof Vue | Function } } = {
            [ComponentIds.Activity]: {
                component: Home
            },
            [ComponentIds.Settings]: {
                component: async () => (await import('~/components/Settings')).default
            }
        };

        Vue.prototype.$canGoBack = function canGoBack() {
            return Frame.topmost().canGoBack();
        };

        function setActivatedUrl(id) {
            if (!id || id === activatedUrl) {
                return;
            }
            const oldActiveUrl = activatedUrl;
            activatedUrl = id;
            // if (oldActiveUrl) {
            //     const index = menuItems.findIndex((d) => d.url === oldActiveUrl);
            //     if (index !== -1) {
            //         const item = menuItems.getItem(index);
            //         item.activated = false;
            //         menuItems.setItem(index, item);
            //     }
            // }
            // if (activatedUrl) {
            //     const index = menuItems.findIndex((d) => d.url === activatedUrl);
            //     if (index !== -1) {
            //         const item = menuItems.getItem(index);
            //         item.activated = true;
            //         menuItems.setItem(index, item);
            //     }
            // }
        }

        Vue.prototype.$onAppMounted = function () {
            Frame.topmost().on(Page.navigatedToEvent, onPageNavigation);
        };
        function onPageNavigation(event) {
            if (!event.entry.resolvedPage) {
                return;
            }
            navigating = false;
            closeDrawer();
            setActivatedUrl(event.entry.resolvedPage[navigateUrlProperty]);
        }
        let activatedUrl;
        const isActiveUrl = (Vue.prototype.$isActiveUrl = function isActiveUrl(id: ComponentIds) {
            return activatedUrl === id;
        });
        const navigateBack = (Vue.prototype.$navigateBack = function navigateBack(backEntry?) {
            return Frame.topmost().goBack(backEntry);
        });
        const findNavigationUrlIndex = (Vue.prototype.$findNavigationUrlIndex = function findNavigationUrlIndex(url) {
            return Frame.topmost().backStack.findIndex((b) => b.resolvedPage[navigateUrlProperty] === url);
        });
        Vue.prototype.$navigateBackIfUrl = function navigateBackIfUrl(url) {
            if (isActiveUrl(url)) {
                navigateBack();
            }
        };
        const navigateBackToUrl = (Vue.prototype.$navigateBackToUrl = function (url) {
            const index = findNavigationUrlIndex(url);
            if (index === -1) {
                console.log(url, 'not in backstack');
                return;
            }
            return navigateBack(Frame.topmost().backStack[index]);
        });
        Vue.prototype.$navigateBackToRoot = function () {
            const stack = Frame.topmost().backStack;
            if (stack.length > 0) {
                Frame.topmost().goBack(stack[0]);
            }
        };
        const openDrawer = (Vue.prototype.$openDrawer = function () {
            Vue.prototype.$drawer.open();
        });
        const closeDrawer = (Vue.prototype.$closeDrawer = function () {
            Vue.prototype.$drawer && Vue.prototype.$drawer.close();
        });

        // Vue.prototype.$navigateTo = function (component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        //     options = options || {};
        //     (options as any).frame = options['frame'] || innerFrame.id;
        //     return super.navigateTo(component, options, cb);
        // };
        Vue.prototype.$navigateToUrl = async function navigateToUrl(url: ComponentIds, options?: NavigationEntry & { props?: any; component?: VueConstructor | Function }, cb?: () => Page) {
            console.log('$navigateToUrl', url, navigating);
            if (isActiveUrl(url) || navigating) {
                closeDrawer();
                return;
            }
            navigating = true;
            const index = findNavigationUrlIndex(url);
            console.log('$navigateToUrl', url, index, options, routes[url]);
            if (index === -1) {
                let component = options?.component || routes[url].component;
                if (typeof component === 'function') {
                    component = await (component as () => Promise<VueConstructor>)();
                }
                return Vue.prototype.$navigateTo(component, options);
            } else {
                return navigateBackToUrl(url);
            }
        };
        let bDevMode = true;

        Vue.prototype.$getDevMode = function () {
            return bDevMode;
        };
        const setDevMode = (Vue.prototype.$setDevMode = function (value) {
            bDevMode = value;
            // if (dbHandler) {
            //     dbHandler.devMode = value;
            // }
            setBoolean('devMode', value);
        });
        Vue.prototype.$switchDevMode = function (args: GestureEventData) {
            if (args && args.ios && args.ios.state !== 3) {
                return;
            }
            setDevMode(!bDevMode);

            showSnack({ message: `devmode:${bDevMode}` });
        };

        let showLoadingStartTime: number = null;
        let loadingIndicator: AlertDialog & {
            instance?: LoadingIndicatorExtended;
        };
        function getLoadingIndicator() {
            if (!loadingIndicator) {
                const instance = new LoadingIndicator() as LoadingIndicatorExtended;
                instance.$mount();
                const view = (instance as any).nativeView;
                // const stack = new GridLayout();
                // stack.padding = 10;
                // stack.style.rows = 'auto,auto';
                // const activityIndicator = new ActivityIndicator();
                // activityIndicator.className = 'activity-indicator';
                // activityIndicator.busy = true;
                // stack.addChild(activityIndicator);
                // const label = new Label();
                // label.paddingLeft = 15;
                // label.textWrap = true;
                // label.verticalAlignment = 'middle';
                // label.fontSize = 16;
                // stack.addChild(label);
                loadingIndicator = new AlertDialog({
                    view,
                    cancelable: false
                });
                loadingIndicator.instance = instance;
                // loadingIndicator.indicator = view.getChildAt(0) as ActivityIndicator;
                // loadingIndicator.label = view.getChildAt(1) as Label;
                // loadingIndicator.progress = view.getChildAt(2) as Progress;
            }
            return loadingIndicator;
        }
        const showingLoading = (Vue.prototype.$showingLoading = function () {
            return showLoadingStartTime !== null;
        });
        const updateLoadingProgress = (Vue.prototype.$updateLoadingProgress = function (msg: Partial<ShowLoadingOptions>) {
            if (showingLoading()) {
                const loadingIndicator = getLoadingIndicator();
                if (msg.text) {
                    loadingIndicator.instance.text = msg.text;
                }
                loadingIndicator.instance.progress = msg.progress;
            }
        });
        const showLoading = (Vue.prototype.$showLoading = function (msg?: string | ShowLoadingOptions) {
            const text = (msg as any)?.text || msg || $tc('loading');
            const loadingIndicator = getLoadingIndicator();
            if (!!msg?.['onButtonTap']) {
                loadingIndicator.instance.$on('tap', msg['onButtonTap']);
            } else {
                loadingIndicator.instance.$off('tap');
                loadingIndicator.instance['showButton'] = !!msg?.['onButtonTap'];
            }
            // if (DEV_LOG) {
            //     log('showLoading', msg, !!loadingIndicator, showLoadingStartTime);
            // }
            loadingIndicator.instance.text = text;
            loadingIndicator.instance.title = (msg as any)?.title;
            if (msg && typeof msg !== 'string' && msg?.hasOwnProperty('progress')) {
                loadingIndicator.instance.progress = msg.progress;
            } else {
                loadingIndicator.instance.progress = null;
            }
            if (showLoadingStartTime === null) {
                showLoadingStartTime = Date.now();
                loadingIndicator.show();
            }
        });
        const hideLoading = (Vue.prototype.$hideLoading = function () {
            const delta = showLoadingStartTime ? Date.now() - showLoadingStartTime : -1;
            if (delta >= 0 && delta < 1000) {
                setTimeout(() => hideLoading(), 1000 - delta);
                return;
            }
            // if (DEV_LOG) {
            //     log('hideLoading', showLoadingStartTime, delta);
            // }
            showLoadingStartTime = null;
            if (loadingIndicator) {
                const loadingIndicator = getLoadingIndicator();
                loadingIndicator.instance.$off('tap');
                loadingIndicator.hide();
            }
        });
        function showErrorInternal(err: Error | string) {
            const delta = showLoadingStartTime ? Date.now() - showLoadingStartTime : -1;
            if (delta >= 0 && delta < 1000) {
                setTimeout(() => showErrorInternal(err), 1000 - delta);
                return;
            }
            hideLoading();
            Vue.prototype.$crashReportService.showError(err);
        }

        const showError = (Vue.prototype.$showError = function (err: Error | string) {
            showErrorInternal(err);
        });

        let glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
        let mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
        let geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);

        Vue.prototype.$checkFirmwareUpdateOnline = function (glassesVersion, beta?: boolean) {
            console.log('checkFirmwareUpdateOnline', glassesVersion, beta);
            getJSON({
                url: `https://gitlab.com/api/v4/projects/9965259/repository/files/${beta ? 'beta' : 'latest'}.json/raw?ref=master`,
                method: 'GET',
                headers: {
                    'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
                }
            })
                .then((response: any) => {
                    DEV_LOG && console.log('checkFirmwareUpdateOnline response', response);
                    // if (response.statusCode === 200) {
                    // const content = response.content;
                    const newVersion = response.version;
                    const compareResult = versionCompare(newVersion, glassesVersion);

                    if (compareResult > 0) {
                        confirm({
                            cancelable: !response.mandatory,
                            title: $t('firmware_update', newVersion),
                            message: response.mandatory ? $t('mandatory_firmware_update_available_desc') : $t('firmware_update_available_desc'),
                            okButtonText: $t('update'),
                            cancelButtonText: response.mandatory ? undefined : $t('cancel')
                        })
                            .then((result) => timeout(500).then(() => result)) // delay a bit for android. Too fast
                            .then((result) => {
                                if (result) {
                                    showLoading($t('downloading_update'));
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
                                        hideLoading();
                                        const component = await import('~/components/FirmwareUpdate');
                                        Vue.prototype.$navigateTo(component.default, { props: { firmwareFile: response } });
                                    });
                                } else if (response.mandatory) {
                                    // quitApp();
                                }
                            })
                            .catch(showError);
                    }
                })
                .catch((error) => {
                    console.error('Https.request error', error);
                });
        };
        Vue.prototype.$checkConfigUpdateOnline = function (glassesVersion, beta?: boolean) {
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
                    const compareResult = versionCompare(newVersion, glassesVersion);

                    if (compareResult > 0) {
                        confirm({
                            cancelable: !response.mandatory,
                            title: $t('firmware_update', newVersion),
                            message: response.mandatory ? $t('mandatory_firmware_update_available_desc') : $t('firmware_update_available_desc'),
                            okButtonText: $t('update'),
                            cancelButtonText: response.mandatory ? undefined : $t('cancel')
                        })
                            .then((result) => timeout(500).then(() => result)) // delay a bit for android. Too fast
                            .then((result) => {
                                if (result) {
                                    showLoading($t('downloading_update'));
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
                                        hideLoading();
                                        // const component = await import('~/components/FirmwareUpdate');
                                        // navigateTo(component.default, { props: { firmwareFile: response } });
                                    });
                                } else if (response.mandatory) {
                                    // quitApp();
                                }
                            })
                            .catch(showError);
                    }
                })
                .catch((error) => {
                    console.error('Https.request error', error);
                });
        };

        async function checkForStoryUpdate(storyId) {
            let progressNotificationId;
            try {
                progressNotificationId = 52346 + hashCode(storyId + '');
                const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + `?path=/&files=${storyId}.zip`;
                const headers = await getHEAD(url);
                const lastSize = ApplicationSettings.getString('GLASSES_DATA_SIZE_' + storyId, '');
                console.log(url, lastSize, headers);
                let workingDir = path.join(getWorkingDir() , 'glasses_images');
                if (storyId === 'navigation' || storyId === 'pastilles') {
                } else {
                    workingDir += '/stories';
                }
                DEV_LOG && console.log('checkForStoryUpdate', storyId, workingDir, lastSize !== headers['content-length'], Folder.exists(path.join(workingDir, storyId + '')));
                if (lastSize !== headers['content-length'] || !Folder.exists(path.join(workingDir, storyId + ''))) {
                    const requestTag = Date.now() + '';

                    const progressNotification = ProgressNotification.show({
                        id: progressNotificationId, //required
                        title: $tc('downloading_glasses_update', storyId),
                        message: '',
                        ongoing: true,
                        indeterminate: false,
                        progressValue: 0
                    });

                    //dismiss notification
                    // showLoading({
                    //     title: $tc('downloading_glasses_update', storyId),
                    //     text: ' ',
                    //     progress: 0,
                    //     onButtonTap: () => cancelRequest(requestTag)
                    // });
                    const filePath = path.join(knownFolders.temp().path, `glasses_images_${storyId}.zip`);
                    const onProgress = throttle((current, total) => {
                        const perc = Math.round((current / total) * 100);
                        ProgressNotification.update(progressNotification, {
                            message: `${fileSize(current)}/${fileSize(total)} (${perc}%)`,
                            progressValue: perc
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
                    console.log('file', file.path, file.size, headers['content-length']);
                    if (File.exists(file.path) && file.size > 0) {
                        ProgressNotification.update(progressNotification, {
                            title: $tc('uncompress_glasses_data', storyId),
                            message: '',
                            progressValue: 0
                        });
                        await Zip.unzip({
                            archive: file.path,
                            directory: workingDir,
                            overwrite: true,
                            onProgress: (percent) => {
                                ProgressNotification.update(progressNotification, {
                                    message: `${Math.round(percent)}%`,
                                    progressValue: percent
                                });
                            }
                        });
                        glassesDataUpdateDate = Date.now();
                        appNotify({ eventName: 'GLASSES_DATA_LASTDATE', data: glassesDataUpdateDate });
                        ApplicationSettings.setNumber('GLASSES_DATA_LASTDATE', glassesDataUpdateDate);
                        ApplicationSettings.setString('GLASSES_DATA_SIZE_' + storyId, headers['content-length']);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                ProgressNotification.dismiss(progressNotificationId);
            }
        }
        let updatingStories = false;
        Vue.prototype.$checkForGlassesDataUpdate = async function () {
            // if (!PRODUCTION) {
            //     return;
            // }
            if (updatingStories) {
                return;
            }
            updatingStories = true;

            await checkForStoryUpdate('navigation');
            await checkForStoryUpdate('pastilles');
            const track = bgService?.geoHandler?.currentTrack;
            if (track) {
                const storyIds = [...new Set(track.geometry.features.map((f) => parseInt('index' in f.properties ? f.properties.index : f.properties.name, 10)).filter((f) => !isNaN(f)))].sort();
                console.log('storyIds', storyIds);
                for (let index = 0; index < storyIds.length; index++) {
                    await checkForStoryUpdate(storyIds[index]);
                }
            }
            updatingStories = false;
        };
        Vue.prototype.$checkForMapDataUpdate = async function () {
            const progressNotificationId = 52305;
            // if (!PRODUCTION) {
            //     return;
            // }
            try {
                const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + '?path=/&files=tiles.zip';
                const headers = await getHEAD(url);
                const lastSize = ApplicationSettings.getString('MAP_DATA_SIZE', '');
                console.log(url, lastSize, headers);
                if (lastSize !== headers['content-length'] || !Folder.exists(path.join(getWorkingDir(), 'tiles'))) {
                    const requestTag = Date.now() + '';
                    const progressNotification = ProgressNotification.show({
                        id: progressNotificationId, //required
                        title: $tc('downloading_map_update'),
                        message: '',
                        ongoing: true,
                        indeterminate: false,
                        progressValue: 0
                    });
                    const filePath = path.join(knownFolders.temp().path, 'tiles.zip');
                    const onProgress = throttle((current, total) => {
                        const perc = Math.round((current / total) * 100);
                        updateLoadingProgress({
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
                    ProgressNotification.update(progressNotification, {
                        title: $tc('uncompress_map_data'),
                        message: '',
                        progressValue: 0
                    });
                    await Zip.unzip({
                        archive: file.path,
                        directory: getWorkingDir(),
                        overwrite: true,
                        onProgress: (percent) => {
                            ProgressNotification.update(progressNotification, {
                                message: `${Math.round(percent)}%`,
                                progressValue: percent
                            });
                        }
                    });
                    mapDataUpdateDate = Date.now();
                    appNotify({ eventName: 'MAP_DATA_LASTDATE', data: mapDataUpdateDate });
                    ApplicationSettings.setString('MAP_DATA_SIZE', headers['content-length']);
                    ApplicationSettings.setNumber('MAP_DATA_LASTDATE', mapDataUpdateDate);
                }
            } catch (error) {
                console.error(error);
            } finally {
                ProgressNotification.dismiss(progressNotificationId);
            }
        };
        Vue.prototype.$checkForGeoJSONUpdate = async function (geojsonPath: string) {
            try {
                const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + '?path=/&files=map.geojson';
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

                    geojsonDataUpdateDate = Date.now();
                    appNotify({ eventName: 'GEOJSON_DATA_LASTDATE', data: geojsonDataUpdateDate });
                    ApplicationSettings.setString('GEOJSON_DATA_SIZE', headers['content-length']);
                    ApplicationSettings.setNumber('GEOJSON_DATA_LASTDATE', geojsonDataUpdateDate);
                }
            } catch (error) {
                console.error(error);
            }
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
