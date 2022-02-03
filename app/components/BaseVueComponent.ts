import { ActivityIndicator } from '@nativescript-community/ui-material-activityindicator';
import { AlertDialog } from '@nativescript-community/ui-material-dialogs';
import { Progress } from '@nativescript-community/ui-material-progress';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { Frame, Label, Page, View } from '@nativescript/core';
import { knownFolders } from '@nativescript/core/file-system';
import { Screen } from '@nativescript/core/platform';
import { ad } from '@nativescript/core/utils/utils';
import { bind } from 'helpful-decorators';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Prop } from 'vue-property-decorator';
import LoadingIndicator from './LoadingIndicator.vue';
import { $tc } from '~/helpers/locale';
import { accentColor, actionBarHeight, darkColor, primaryColor } from '../variables';
import { ShowLoadingOptions } from '~/vue.prototype';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & {
        instance?: LoadingIndicator & {
            showButton: boolean;
            title: string;
            text: string;
            progress: number;
        };
    };
    $refs: BaseVueComponentRefs;
    @Prop({ type: String, default: primaryColor })
    public themeColor;
    @Prop({ type: String, default: darkColor })
    public darkColor;
    @Prop({ type: String, default: accentColor })
    public accentColor;
    public actionBarHeight = actionBarHeight;
    needsRoundedWatchesHandle = false;
    debug = false;
    get page() {
        return this.getRef<Page>('page');
    }

    get devMode() {
        return this.$getDevMode();
    }
    getRef<T extends View = View>(key: string) {
        if (this.$refs[key]) {
            return (this.$refs[key] as NativeScriptVue<T>).nativeView;
        }
    }
    noop() {}
    getLoadingIndicator() {
        if (!this.loadingIndicator) {
            const instance = new (require('./LoadingIndicator.vue').default)();
            instance.$mount();
            const view = instance.nativeView;
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
            this.loadingIndicator = new AlertDialog({
                view,
                cancelable: false
            });
            this.loadingIndicator.instance = instance;
        }
        return this.loadingIndicator;
    }

    showLoadingStartTime: number = null;
    showingLoading() {
        return this.showLoadingStartTime !== null;
    }
    updateLoadingProgress(msg: Partial<ShowLoadingOptions>) {
        return this.$updateLoadingProgress(msg);
    }
    showLoading(msg?: string | ShowLoadingOptions) {
        return this.$showLoading(msg);
    }
    hideLoading() {
        return this.$hideLoading();
    }

    mounted() {
        if (this.nativeView && this['navigateUrl']) {
            this.nativeView['navigateUrl'] = this['navigateUrl'];
        }
        const page = this.page;
        if (page) {
            page.actionBarHidden = true;
            if (__IOS__) {
                page.backgroundSpanUnderStatusBar = true;
            }
        }
    }
    destroyed() {}

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || Frame.topmost().id;
        return this.$navigateTo(component, options, cb).catch(this.showError);
    }
    showError(err: Error | string) {
        this.$showError(err);
    }

    goBack() {
        this.$navigateBack();
    }

    async shareFile(content: string, fileName: string) {
        const file = knownFolders.temp().getFile(fileName);
        await file.writeText(content);
        const shareFile = new ShareFile();
        await shareFile.open({
            path: file.path,
            title: fileName,
            options: true, // optional iOS
            animated: true // optional iOS
        });
    }
}
