import { BgService } from '~/services/BgService';
import App from '~/components/App';
import CrashReportService from '~/services/CrashReportService';
import { Drawer } from '@nativescript-community/ui-drawer';

declare module 'vue/types/vue' {
    // 3. Declare augmentation for Vue
    interface Vue {
        $bgService: BgService;
        $crashReportService: CrashReportService;
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

        $checkFirmwareUpdateOnline(glassesVersion, beta?: boolean): Promise<void>;
        $checkConfigUpdateOnline(glassesVersion, beta?: boolean): Promise<void>;
        $checkForGlassesDataUpdate(): Promise<void>;
        $checkForMapDataUpdate(): Promise<void>;
        $checkForGeoJSONUpdate(geojsonPath: string): Promise<void>;
    }
}
