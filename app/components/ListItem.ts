import { Component, Prop, Watch } from 'vue-property-decorator';
import Vue from 'nativescript-vue';
import { accentColor, borderColor, mdiFontFamily, textColor } from '~/variables';
import { Color } from '@nativescript/core/color';

@Component({
    inheritAttrs: false
})
export default class ListItem extends Vue {
    mdiFontFamily = mdiFontFamily;
    borderColor = borderColor;
    accentColor = accentColor;
    defaultTextColor = textColor;
    @Prop({})
    title: string;
    @Prop({})
    rightTitle: string;
    @Prop({})
    icon: string;
    @Prop({ default: () => accentColor })
    color: Color;
    @Prop({})
    textColor: string;
    @Prop({ default: false, type: Boolean })
    chevron: boolean;
    @Prop({ default: false, type: Boolean })
    coloredIcon: boolean;
    @Prop({ default: false })
    checked: boolean;
    @Prop({ default: false })
    selected: boolean;

    ignoreFirst = true;
    onLongPress(event) {
        this.$emit('longPress', event);
    }
    onTap(event) {
        this.$emit('tap', event);
    }
    onCheckedChange(event) {
        console.log('onCheckedChange', event.value , !!this.nativeView);
        // if (this.ignoreFirst && event.value) {
        //     this.ignoreFirst = false;
        //     return;
        // }
        // this.ignoreFirst = false;
        if (this.nativeView) {
            this.$emit('checkedChange', event);
        }
    }
}
