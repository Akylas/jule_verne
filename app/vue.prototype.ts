import { AlertDialog } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Device, Frame, GestureEventData, NavigationEntry, Page, Screen } from '@nativescript/core';
import { on as applicationOn, exitEvent } from '@nativescript/core/application';
import { setBoolean } from '@nativescript/core/application-settings';
import VueType, { VueConstructor } from 'vue';
import Home from '~/components/Home';
import LoadingIndicator from '~/components/LoadingIndicator.vue';
import { $t, $tc, $tt, $tu } from '~/helpers/locale';
import { BgService } from '~/services/BgService';
import { NetworkService } from '~/services/NetworkService';
import { alert } from '~/utils/dialogs';

VueType.prototype.$filters = VueType['options'].filters;

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
        const networkService = new NetworkService();
        applicationOn(exitEvent, () => networkService.stop(), this);
        networkService.start();
        const bgService = new BgService();
        Vue.prototype.$bgService = bgService;
        Vue.prototype.$networkService = networkService;

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
        Vue.prototype.$updateLoadingProgress = function (msg: Partial<ShowLoadingOptions>) {
            if (showingLoading()) {
                const loadingIndicator = getLoadingIndicator();
                if (msg.text) {
                    loadingIndicator.instance.text = msg.text;
                }
                loadingIndicator.instance.progress = msg.progress;
            }
        };
        Vue.prototype.$showLoading = function (msg?: string | ShowLoadingOptions) {
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
        };
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

        Vue.prototype.$showError = function (err: Error | string) {
            showErrorInternal(err);
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
