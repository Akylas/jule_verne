import { BgService } from '~/services/BgService';
import App from '~/components/App';
import CrashReportService from '~/services/CrashReportService';
import { Drawer } from '@nativescript-community/ui-drawer';
import { NetworkService } from '~/services/NetworkService';

declare module 'vue/types/vue' {
    // 3. Declare augmentation for Vue
    interface Vue {
        $bgService: BgService;
        $crashReportService: CrashReportService;
        $networkService: NetworkService;
        $drawer: Drawer;

        $t: (s: string, ...args) => string;
        $tc: (s: string, ...args) => string;
        $tt: (s: string, ...args) => string;
        $tu: (s: string, ...args) => string;
        $filters: {
            titlecase(s: string): string;
            uppercase(s: string): string;
            L(s: string, ...args): string;
        };
        $alert(message: string);
        $showError(err: Error | string);

        $onAppMounted();
        $navigateBack();
        $openDrawer();
        $closeDrawer();
        $canGoBack(): boolean;
        $navigateBackIfUrl(url);
        $isActiveUrl(id: ComponentIds): boolean;
        $navigateToUrl(url: ComponentIds, options?: NavigationEntry & { props?: any; component?: VueConstructor }, cb?: () => Page);

        $getDevMode(): boolean;
        $setDevMode(value);
        $switchDevMode(args: GestureEventData);

        $updateLoadingProgress(msg: Partial<ShowLoadingOptions>);
        $showLoading(msg?: string | ShowLoadingOptions);
        $hideLoading();
    }
}
