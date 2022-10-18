import { foregroundEvent } from '@akylas/nativescript/application';
import { Application, ApplicationSettings, EventData, File, Folder, Observable, knownFolders, path } from '@nativescript/core';
import { ApplicationEventData } from '@nativescript/core/application';
import * as connectivity from '@nativescript/core/connectivity';
import { CachePolicy, HttpsRequestOptions as IHttpsRequestOptions, cancelRequest, request, setCache } from '@nativescript-community/https';
import { notify as appNotify, hashCode, timeout, versionCompare } from '~/utils';
import { confirm } from '@nativescript-community/ui-material-dialogs';
import Vue from 'nativescript-vue';
import { $t, $tc } from '~/helpers/locale';
import { getWorkingDir, throttle } from '~/utils/utils';
import * as ProgressNotification from '~/services/android/ProgressNotifications';
import { filesize } from 'filesize';
import { Zip } from '@nativescript/zip';
import { GlassesVersions } from '~/handlers/bluetooth/GlassesDevice';
import { StoryHandler } from '~/handlers/StoryHandler';

const ACTIVELOOK_UPDATE_URL = 'http://vps468290.ovh.net/v1';

export const NetworkConnectionStateEvent = 'NetworkConnectionStateEvent';
export interface NetworkConnectionStateEventData extends EventData {
    data: {
        connected: boolean;
        connectionType: connectivity.connectionType;
    };
}

export interface HttpRequestOptions extends IHttpsRequestOptions {
    body?;
    cachePolicy?: CachePolicy;
    queryParams?: {};
    apiPath?: string;
    multipartParams?;
    canRetry?;
}

export async function getJSON<T = any>(arg: any): Promise<T> {
    return (await request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg)).content.toJSON();
}

export async function getHEAD<T>(arg: any) {
    return (await request<T>(typeof arg === 'string' ? { url: arg, method: 'HEAD' } : arg)).headers;
}

export async function getFile(arg: string | HttpRequestOptions, destinationFilePath?: string) {
    return (await request(typeof arg === 'string' ? { url: arg, method: 'GET' } : arg)).content.toFile(destinationFilePath);
}

export class NetworkService extends Observable {
    // @stringProperty token: string;
    // @stringProperty refreshToken: string;
    authority: string;
    _connectionType: connectivity.connectionType = connectivity.connectionType.none;
    _connected = false;
    get connected() {
        return this._connected;
    }
    set connected(value: boolean) {
        if (this._connected !== value) {
            this._connected = value;
            this.onConnectionChanged(value);
        }
    }

    onConnectionChanged(value: boolean) {
        this.notify({
            eventName: NetworkConnectionStateEvent,
            object: this,
            data: {
                connected: value,
                connectionType: this._connectionType
            }
        } as NetworkConnectionStateEventData);
    }
    get connectionType() {
        return this._connectionType;
    }
    set connectionType(value: connectivity.connectionType) {
        if (this._connectionType !== value) {
            DEV_LOG && console.log('NetworkService', 'set connectionType', value, this._connectionType);
            this._connectionType = value;
            this.connected = value !== connectivity.connectionType.none;
        }
    }
    constructor() {
        super();
        this.connectionType = connectivity.getConnectionType();
    }
    start() {
        this.connectionType = connectivity.getConnectionType();
        connectivity.startMonitoring(this.onConnectionStateChange.bind(this));
        Application.on(foregroundEvent, this.onAppResume, this);
        const folder = knownFolders.temp().getFolder('cache');
        const diskLocation = folder.path;
        const cacheSize = 10 * 1024 * 1024;
        setCache({
            forceCache: !PRODUCTION,
            diskLocation,
            diskSize: cacheSize,
            memorySize: cacheSize
        });
    }
    stop() {
        Application.off(foregroundEvent, this.onAppResume, this);
        connectivity.stopMonitoring();
    }
    onAppResume(args: ApplicationEventData) {
        this.connectionType = connectivity.getConnectionType();
    }
    onConnectionStateChange(newConnectionType: connectivity.connectionType) {
        this.connectionType = newConnectionType;
    }

    glassesDataUpdateDate = ApplicationSettings.getNumber('GLASSES_DATA_LASTDATE', null);
    mapDataUpdateDate = ApplicationSettings.getNumber('MAP_DATA_LASTDATE', null);
    geojsonDataUpdateDate = ApplicationSettings.getNumber('GEOJSON_DATA_LASTDATE', null);

    async checkFirmwareUpdateOnline(versions: GlassesVersions, beta?: boolean) {
        if (!this.connected) {
            return;
        }

        try {
            const firmware = versions.firmware.replace(/[^.0-9]/g, '');
            const url = `${ACTIVELOOK_UPDATE_URL}/firmwares/${versions.hardware}/${beta ? ACTIVELOOK_INTERNAL_TOKEN : ACTIVELOOK_BETA_TOKEN}?compatibility=${4}&min-version=${firmware}`;
            const response = await getJSON(url);
            // if (response.statusCode === 200) {
            // const content = response.content;

            const newVersion = response.latest?.version?.join('.');
            DEV_LOG && console.log('checkFirmwareUpdateOnline response', response, newVersion, firmware, url);
            if (response.latest && newVersion !== firmware && versionCompare(newVersion, firmware) > 0) {
                confirm({
                    title: $t('firmware_update', newVersion),
                    message: $t('firmware_update_available_desc'),
                    okButtonText: $t('update'),
                    cancelButtonText: $t('cancel')
                })
                    .then((result) => timeout(500).then(() => result)) // delay a bit for android. Too fast
                    .then((result) => {
                        if (result) {
                            Vue.prototype.$showLoading($t('downloading_update'));
                            const filePath = path.join(knownFolders.temp().path, `update_${newVersion}.img`);
                            return getFile(
                                {
                                    url: `${ACTIVELOOK_UPDATE_URL}${response.latest.api_path}`,
                                    method: 'GET'
                                },
                                filePath
                            ).then(async (response) => {
                                Vue.prototype.$hideLoading();
                                const component = await import('~/components/FirmwareUpdate.vue');
                                Vue.prototype.$navigateTo(component.default, { props: { firmwareFile: response } });
                            });
                        } else if (response.mandatory) {
                            // quitApp();
                        }
                    })
                    .catch(Vue.prototype.$showError);
            }
        } catch (error) {
            console.error('Https.request error', error);
        }
    }

    // checkConfigUpdateOnline(glassesVersion, beta?: boolean) {
    //     getJSON({
    //         url: `https://gitlab.com/api/v4/projects/20247090/repository/files/${beta ? 'beta' : 'latest'}.json/raw?ref=master`,
    //         method: 'GET',
    //         headers: {
    //             'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
    //         }
    //     })
    //         .then((response: any) => {
    //             // if (response.statusCode === 200) {
    //             // const content = response.content;
    //             const newVersion = response.version;
    //             const compareResult = versionCompare(newVersion, glassesVersion);

    //             if (compareResult > 0) {
    //                 confirm({
    //                     cancelable: !response.mandatory,
    //                     title: $t('firmware_update', newVersion),
    //                     message: response.mandatory ? $t('mandatory_firmware_update_available_desc') : $t('firmware_update_available_desc'),
    //                     okButtonText: $t('update'),
    //                     cancelButtonText: response.mandatory ? undefined : $t('cancel')
    //                 })
    //                     .then((result) => timeout(500).then(() => result)) // delay a bit for android. Too fast
    //                     .then((result) => {
    //                         if (result) {
    //                             Vue.prototype.$showLoading($t('downloading_update'));
    //                             const filePath = path.join(knownFolders.temp().path, `config_update_${newVersion}.txt`);
    //                             return getFile(
    //                                 {
    //                                     url: response.url,
    //                                     method: 'GET',
    //                                     headers: {
    //                                         'Private-Token': 'RSKG-kgSP9pyEuLYz6NE'
    //                                     }
    //                                 },
    //                                 filePath
    //                             ).then(async (response) => {
    //                                 Vue.prototype.$hideLoading();
    //                                 // const component = await import('~/components/FirmwareUpdate');
    //                                 // navigateTo(component.default, { props: { firmwareFile: response } });
    //                             });
    //                         } else if (response.mandatory) {
    //                             // quitApp();
    //                         }
    //                     })
    //                     .catch(Vue.prototype.$showError);
    //             }
    //         })
    //         .catch((error) => {
    //             console.error('Https.request error', error);
    //         });
    // }

    async checkForStoryUpdate(storyId, forceReload = false) {
        let progressNotificationId;
        try {
            progressNotificationId = 52346 + hashCode(storyId + '');
            const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + `?path=/&files=${storyId}.zip`;
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('GLASSES_DATA_SIZE_' + storyId, '');
            let workingDir = path.join(getWorkingDir(), 'glasses_images');
            if (storyId !== 'navigation' && storyId !== 'pastilles') {
                workingDir += '/stories';
            }
            const storyDirPath = path.join(workingDir, storyId + '');
            const newContentSize = headers['content-length'];
            DEV_LOG && console.log('checkForStoryUpdate', url, storyId, workingDir, newContentSize, typeof newContentSize, lastSize !== newContentSize, Folder.exists(storyDirPath));

            if (forceReload || lastSize !== newContentSize || !Folder.exists(storyDirPath)) {
                const requestTag = Date.now() + '';

                const progressNotification = ProgressNotification.show({
                    id: progressNotificationId, //required
                    icon: 'mdi-glasses',
                    smallIcon: 'mdi-download',
                    title: $tc('downloading_glasses_update', storyId),
                    message: filesize(parseInt(newContentSize, 10)) as string,
                    ongoing: true,
                    indeterminate: false,
                    progress: 0,
                    actions: [
                        {
                            id: 'cancel',
                            text: 'mdi-close',
                            notifText: $tc('cancel'),
                            callback: () => {
                                DEV_LOG && console.log('cancelling downloading request', url, requestTag);
                                cancelRequest(requestTag);
                            }
                        }
                    ]
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
                        rightIcon: `${perc}%`,
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
                if (File.exists(file.path) && file.size > 0) {
                    ProgressNotification.update(progressNotification, {
                        title: $tc('uncompress_glasses_data', storyId),
                        rightIcon: '0%',
                        progress: 0
                    });
                    await Folder.fromPath(storyDirPath).remove();
                    await Zip.unzip({
                        archive: file.path,
                        directory: workingDir,
                        overwrite: true,
                        onProgress: (percent) => {
                            ProgressNotification.update(progressNotification, {
                                rightIcon: `${Math.round(percent)}%`,
                                progress: percent
                            });
                        }
                    });
                    this.glassesDataUpdateDate = Date.now();
                    appNotify({ eventName: 'GLASSES_DATA_LASTDATE', data: this.glassesDataUpdateDate });
                    ApplicationSettings.setNumber('GLASSES_DATA_LASTDATE', this.glassesDataUpdateDate);
                    ApplicationSettings.setString('GLASSES_DATA_SIZE_' + storyId, headers['content-length']);
                }
            }
        } catch (error) {
            console.error('checkForStoryUpdate', error, error.stack);
        } finally {
            ProgressNotification.dismiss(progressNotificationId);
        }
    }
    updatingStories = false;

    async checkForGlassesDataUpdate(forceReload = false) {
        // if (!PRODUCTION) {
        //     return;
        // }
        if (!this.connected || this.updatingStories) {
            return;
        }
        this.updatingStories = true;
        const toUpdate = ['navigation', 'pastilles', '1000'];
        const track = (Vue.prototype.$bgService?.storyHandler as StoryHandler)?.currentTrack;
        if (track) {
            const storyIds = [...new Set(track.geometry.features.map((f) => parseInt('index' in f.properties ? f.properties.index : f.properties.name, 10)).filter((f) => !isNaN(f)))].sort();
            for (let index = 0; index < storyIds.length; index++) {
                toUpdate.push(storyIds[index] + '');
            }
        }
        for (let index = 0; index < toUpdate.length; index++) {
            await this.checkForStoryUpdate(toUpdate[index], forceReload);
        }
        // await Promise.all(toUpdate.map(this.checkForStoryUpdate));
        // await this.checkForStoryUpdate('navigation');
        // await this.checkForStoryUpdate('pastilles');
        // const track = (Vue.prototype.$bgService?.storyHandler as StoryHandler)?.currentTrack;
        // if (track) {
        //     const storyIds = [...new Set(track.geometry.features.map((f) => parseInt('index' in f.properties ? f.properties.index : f.properties.name, 10)).filter((f) => !isNaN(f)))].sort();
        //     for (let index = 0; index < storyIds.length; index++) {
        //         await this.checkForStoryUpdate(storyIds[index]);
        //     }
        // }
        this.updatingStories = false;
    }
    updatingMapData = false;
    async checkForMapDataUpdate() {
        const progressNotificationId = 12305;
        if (this.updatingMapData || !this.connected) {
            return;
        }
        try {
            this.updatingMapData = true;
            const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + '?path=/&files=tiles.zip';
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('MAP_DATA_SIZE', '');
            DEV_LOG && console.log(url, lastSize, headers['content-length']);
            if (lastSize !== headers['content-length'] || !Folder.exists(path.join(getWorkingDir(false), 'tiles'))) {
                const requestTag = Date.now() + '';
                const progressNotification = ProgressNotification.show({
                    id: progressNotificationId, //required
                    icon: 'mdi-map',
                    smallIcon: 'mdi-download',
                    title: $tc('downloading_map_update'),
                    message: filesize(parseInt(headers['content-length'], 10)) as string,
                    ongoing: true,
                    indeterminate: false,
                    progress: 0,
                    actions: [
                        {
                            id: 'cancel',
                            text: 'mdi-close',
                            notifText: $tc('cancel'),
                            callback: () => {
                                DEV_LOG && console.log('cancelling downloading request', url, requestTag);
                                cancelRequest(requestTag);
                            }
                        }
                    ]
                });
                const filePath = path.join(knownFolders.temp().path, 'tiles.zip');
                const onProgress = throttle((current, total) => {
                    const perc = Math.round((current / total) * 100);
                    ProgressNotification.update(progressNotification, {
                        rightIcon: `${perc}%`,
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
                    rightIcon: '0%',
                    progress: 0
                });
                await Zip.unzip({
                    archive: file.path,
                    directory: getWorkingDir(false),
                    overwrite: true,
                    onProgress: (percent) => {
                        ProgressNotification.update(progressNotification, {
                            rightIcon: `${Math.round(percent)}%`,
                            progress: percent
                        });
                    }
                });
                this.mapDataUpdateDate = Date.now();
                appNotify({ eventName: 'MAP_DATA_LASTDATE', data: this.mapDataUpdateDate });
                ApplicationSettings.setString('MAP_DATA_SIZE', headers['content-length']);
                ApplicationSettings.setNumber('MAP_DATA_LASTDATE', this.mapDataUpdateDate);
            }
        } catch (error) {
            console.error('checkFoMapDataUpdate', error, error.stack);
        } finally {
            this.updatingMapData = false;
            ProgressNotification.dismiss(progressNotificationId);
        }
    }

    updatingGeoJSON = false;
    async checkForGeoJSONUpdate(geojsonPath: string) {
        if (this.updatingGeoJSON || !this.connected) {
            return;
        }
        try {
            this.updatingGeoJSON = true;
            const url = ApplicationSettings.getString('UPDATE_DATA_DEFAULT_URL', UPDATE_DATA_DEFAULT_URL) + '?path=/&files=map.geojson';
            const headers = await getHEAD(url);
            const lastSize = ApplicationSettings.getString('GEOJSON_DATA_SIZE', '');
            DEV_LOG && console.log('checkForGeoJSONUpdate', url, lastSize, headers['content-length']);
            if (lastSize !== headers['content-length']) {
                await getFile(
                    {
                        url,
                        method: 'GET'
                    },
                    geojsonPath
                );

                this.geojsonDataUpdateDate = Date.now();
                appNotify({ eventName: 'GEOJSON_DATA_LASTDATE', data: this.geojsonDataUpdateDate });
                ApplicationSettings.setString('GEOJSON_DATA_SIZE', headers['content-length']);
                ApplicationSettings.setNumber('GEOJSON_DATA_LASTDATE', this.geojsonDataUpdateDate);
            }
        } catch (error) {
            console.error('checkForGeoJSONUpdate', error, error.stack);
        } finally {
            this.updatingGeoJSON = false;
        }
    }
}
