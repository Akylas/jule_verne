import Vue from 'nativescript-vue';
import { Frame, topmost } from '@nativescript/core/ui/frame';
import { Component, Prop, Watch } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { GestureEventData } from '@nativescript/core/ui/gestures';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';

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

    @Prop({ default: 0, type: Number })
    public battery: number;

    @Prop({ default: false })
    public showGlassesIcon: boolean;

    @Prop({ default: null })
    public glasses: GlassesDevice;

    get menuIcon() {
        if (this.modal) {
            return 'mdi-close';
        }
        if (this.canGoBack) {
            return __IOS__ ? 'mdi-chevron-left' : 'mdi-arrow-left';
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

    get glassesBatteryColumns() {
        const value = this.battery;
        if (value > 0) {
            return value + '*,' + (100 - value) + '*';
        }
        return '0,*';
    }
    get glassBatteryColor() {
        if (this.battery > 40) {
            return '#53da22';
        }
        if (this.battery > 20) {
            return '#FDB92C';
        }
        return '#ed243e';
    }

    get shouldShowGlassesIcon() {
        return this.showGlassesIcon || !!this.glasses;
    }

    onGlassesButton() {
        this.$emit('tapGlass');
    }
    onLongGlassesButton(args: GestureEventData) {
        if (args && args.ios && args.ios.state !== 3) {
            return;
        }
        this.$emit('longPressGlass', args);
    }
}
