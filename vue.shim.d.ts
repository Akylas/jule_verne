import { BgService } from '~/services/BgService';
import App from '~/components/App';
import CrashReportService from '~/services/CrashReportService';


declare module 'vue/types/vue' {
    // 3. Declare augmentation for Vue
    interface Vue {
        $bgService: BgService;
        $crashReportService: CrashReportService;

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
        $setAppComponent(comp: App);
        $getAppComponent(): App;
    }
}
