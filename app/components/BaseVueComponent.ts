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
import { accentColor, actionBarHeight, darkColor, primaryColor } from '../variables';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export interface ShowLoadingOptions {
    text: string;
    progress?: number;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & { label?: Label; indicator?: ActivityIndicator; progress?: Progress };
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
        return this.$getAppComponent().devMode;
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
            this.loadingIndicator.indicator = view.getChildAt(0) as ActivityIndicator;
            this.loadingIndicator.label = view.getChildAt(1) as Label;
            this.loadingIndicator.progress = view.getChildAt(2) as Progress;
        }
        return this.loadingIndicator;
    }

    showLoadingStartTime: number = null;
    showLoading(msg: string | ShowLoadingOptions) {
        const text = (msg as any).text || msg;
        const loadingIndicator = this.getLoadingIndicator();
        // if (DEV_LOG) {
        //     this.log('showLoading', msg, !!this.loadingIndicator, this.showLoadingStartTime);
        // }
        loadingIndicator.label.text = text + '...';
        if (typeof msg !== 'string' && msg.hasOwnProperty('progress')) {
            loadingIndicator.indicator.visibility = 'collapse';
            loadingIndicator.progress.visibility = 'visible';
            loadingIndicator.progress.value = msg.progress;
        } else {
            loadingIndicator.indicator.visibility = 'visible';
            loadingIndicator.progress.visibility = 'collapse';
        }
        if (this.showLoadingStartTime === null) {
            this.showLoadingStartTime = Date.now();
            loadingIndicator.show();
        }
    }
    hideLoading() {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.hideLoading(), 1000 - delta);
            return;
        }
        // if (DEV_LOG) {
        //     this.log('hideLoading', this.showLoadingStartTime, delta);
        // }
        this.showLoadingStartTime = null;
        if (this.loadingIndicator) {
            this.loadingIndicator.hide();
        }
    }
    static isRounded: boolean;
    public isRounded: boolean = null;
    isRoundeWatch() {
        if (this.isRounded === null) {
            if (BaseVueComponent.isRounded === undefined) {
                if (global.isAndroid && android.os.Build.VERSION.SDK_INT >= 23) {
                    BaseVueComponent.isRounded = (ad.getApplicationContext() as android.content.Context).getResources().getConfiguration().isScreenRound();
                    // https://developer.android.com/reference/android/content/res/Configuration.html#isScreenRound()
                } else {
                    BaseVueComponent.isRounded = false;
                }
            }
            this.isRounded = BaseVueComponent.isRounded;
        }
        return this.isRounded;
    }
    mounted() {
        console.log('mounted');
        if (this.nativeView && this['navigateUrl']) {
            this.nativeView['navigateUrl'] = this['navigateUrl'];
        }
        const page = this.page;
        if (page) {
            page.actionBarHidden = true;
            if (global.isIOS) {
                page.backgroundSpanUnderStatusBar = true;
            }
        }
        this.isRoundeWatch();
        if (this.isRounded && this.needsRoundedWatchesHandle) {
            this.handleRoundedWatches();
        }
    }
    handleRoundedWatches() {
        const page = this.page;
        if (page) {
            page.style.padding = Screen.mainScreen.widthDIPs * 0.146467; // c = a * sqrt(2);
        }
    }
    destroyed() {}

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || Frame.topmost().id;
        return this.$navigateTo(component, options, cb).catch(this.showError);
    }
    @bind
    showError(err: Error | string) {
        this.showErrorInternal(err);
    }
    showErrorInternal(err: Error | string) {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.showErrorInternal(err), 1000 - delta);
            return;
        }
        this.hideLoading();
        this.$crashReportService.showError(err);
    }

    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }
    err(...args) {
        console.error(`[${this.constructor.name}]`, ...args);
    }

    goBack() {
        this.$getAppComponent().goBack();
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

        // });
    }
}
