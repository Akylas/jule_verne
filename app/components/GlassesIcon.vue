<template>
    <!-- <GridLayout rows="*,6,10,8,4,auto,*" columns="*,21,9,*">
        <MDButton rowSpan="6" colSpan="4" class="icon-btn" variant="text" :text="'mdi-sunglasses'" @tap="$emit('tap', $event)" @longPress="onLongGlassesButton" />
        <Label isUserInteractionEnabled="false" :backgroundColor="glasses ? '#53da22' : '#ed243e'" borderRadius="4.5" row="2" col="2" />
        <GridLayout :columns="glassesBatteryColumns" backgroundColor="#E4E4E4" width="24" borderRadius="1" height="4" row="4" col="1" colSpan="2">
            <AbsoluteLayout col="0" :backgroundColor="glassBatteryColor" />
        </GridLayout>
        <Label isUserInteractionEnabled="false" horizontalAlignment="center" fontSize="7" fontWeight="bold" :text="battery + '%'" row="5" col="1" colSpan="2" />
    </GridLayout> -->
    <GridLayout @tap="$emit('tap', $event)" @longPress="onLongGlassesButton" rows="auto" columns="auto">
        <Image v-show="showImage" src="res://glasses_small" height="40" />
        <Label
            :backgroundColor="glassBatteryColor"
            width="20"
            height="20"
            borderRadius="10"
            horizontalAlignment="right"
            verticalAlignment="bottom"
            :borderColor="headsetBatteryColor"
            borderWidth="2"
            :margin="showImage ? 0 : 10"
        />
    </GridLayout>
</template>

<script lang="ts">
import { GestureEventData } from '@nativescript/core/ui';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import { HeadSet } from '~/handlers/BluetoothHandler';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class GlassesIcon extends BaseVueComponent {
    @Prop({ default: 0, type: Number }) battery: number;

    @Prop({ default: null }) glasses: GlassesDevice;
    @Prop({ default: null }) headset: HeadSet;
    @Prop({ default: false, type: Boolean }) showImage: boolean;

    get glassesBatteryColumns() {
        const value = this.battery;
        if (value > 0) {
            return value + '*,' + (100 - value) + '*';
        }
        return '0,*';
    }
    get glassBatteryColor() {
        if (!this.glasses) {
            return '#aaa';
        }
        if (this.battery > 40) {
            return '#53da22';
        }
        if (this.battery > 20) {
            return '#FDB92C';
        }
        return '#ed243e';
    }

    get headsetBatteryColor() {
        if (!this.headset) {
            return '#aaa';
        }
        if (this.headset.battery > 40) {
            return '#53da22';
        }
        if (this.headset.battery > 20) {
            return '#FDB92C';
        }
        return '#ed243e';
    }

    onGlassesButton() {
        this.$emit('tapGlass');
    }
    onLongGlassesButton(args: GestureEventData) {
        if (__IOS__ && args?.ios?.state !== 3) {
            return;
        }
        this.$emit('longPress', args);
    }
}
</script>
