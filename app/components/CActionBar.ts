import Vue from 'nativescript-vue';
import { Frame, topmost } from '@nativescript/core/ui/frame';
import { Component, Prop, Watch } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { GestureEventData } from '@nativescript/core/ui/gestures';

@Component({})
export default class ActionBar extends BaseVueComponent {
    @Prop({
        default: null
    })
    public title: string;

    @Prop({ default: null })
    public subtitle: string;

    @Prop({ default: false, type: Boolean })
    public showMenuIcon: boolean;

    @Prop({ default: false, type: Boolean })
    public disableBackButton: boolean;

    // @Prop({ default: false })
    public canGoBack = false;

    @Prop({ default: true })
    public showLogo: boolean;
    @Prop({ default: false, type: Boolean })
    public modal: boolean;

    get menuIcon() {
        if (this.modal) {
            return 'mdi-close';
        }
        if (this.canGoBack) {
            return global.isIOS ? 'mdi-chevron-left' : 'mdi-arrow-left';
        }
        return 'mdi-menu';
    }
    get menuIconVisible() {
        return (this.canGoBack && !this.disableBackButton) || this.showMenuIcon;
    }
    get menuIconVisibility() {
        return this.menuIconVisible ? 'visible' : 'collapsed';
    }

    mounted() {
        setTimeout(() => {
            this.canGoBack = this.modal || this.$getAppComponent().canGoBack();
        }, 0);
    }
    onMenuIcon() {
        if (this.modal) {
            this.$modal.close();
        } else {
            this.$getAppComponent().onMenuIcon();
        }
    }
}
