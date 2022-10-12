<template>
    <GridLayout id="listitem" :rippleColor="color" height="60" columns="auto,*" :backgroundColor="selected ? color : backgroundColor">
        <CheckBox v-show="showChecked" :checked="checked" verticalAlignment="center" @checkedChange="onCheckedChange" :fillColor="accentColor" marginLeft="10" />
        <CanvasLabel @tap="onTap" @longPress="onLongPress" col="1" id="listitemcanvaslabel" paddingLeft="16" :color="defaultTextColor" fontSize="14">
            <CSpan
                :visibilty="icon ? 'visible' : 'hidden'"
                textAlignment="center"
                verticalAlignment="center"
                :color="coloredIcon ? color : 'white'"
                fontSize="18"
                :fontFamily="mdiFontFamily"
                :text="icon"
                width="36"
                height="36"
                :backgroundColor="coloredIcon ? null : color"
                borderRadius="7"
            />
            <CSpan :color="textColor" :paddingLeft="icon ? 50 : 0" fontSize="20" verticalAlignment="center" :text="title" />
            <CSpan v-show="rightTitle" fontWeight="400" textAlignment="right" color="#A4A4A4" paddingRight="45" fontSize="14" verticalAlignment="center" :text="rightTitle" />
            <CSpan :visibility="chevron ? 'visible' : 'hidden'" paddingRight="15" textAlignment="right" :fontFamily="mdiFontFamily" fontSize="14" verticalAlignment="middle" text="mdi-chevron-right" />
            <Line :fillColor="borderColor" strokeWidth="2" verticalAlignment="bottom" startX="0" stopX="80%" />
        </CanvasLabel>
    </GridLayout>
</template>

<script lang="ts">
import { Color } from '@nativescript/core/color';
import Vue from 'nativescript-vue';
import { Component, Prop } from 'vue-property-decorator';
import { accentColor, backgroundColor, borderColor, mdiFontFamily, textColor } from '~/variables';

@Component({
    inheritAttrs: false
})
export default class ListItem extends Vue {
    mdiFontFamily = mdiFontFamily;
    borderColor = borderColor;
    backgroundColor = backgroundColor;
    accentColor = accentColor;
    defaultTextColor = textColor;
    ignoreFirst = true;
    
    @Prop({}) title: string;
    @Prop({}) rightTitle: string;
    @Prop({}) icon: string;
    @Prop({ default: () => accentColor }) color: Color;
    @Prop({}) textColor: string;
    @Prop({ default: false, type: Boolean }) chevron: boolean;
    @Prop({ default: false, type: Boolean }) coloredIcon: boolean;
    @Prop({ default: false }) checked: boolean;
    @Prop({ default: false }) showChecked: boolean;
    @Prop({ default: false }) selected: boolean;

    onLongPress(event) {
        this.$emit('longPress', event);
    }
    onTap(event) {
        this.$emit('tap', event);
    }
    onCheckedChange(event) {
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
</script>
