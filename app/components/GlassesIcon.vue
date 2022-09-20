<template>
    <GridLayout class="glassIconLayout" rows="*,6,10,8,4,auto,*" columns="*,21,9,*">
        <MDButton rowSpan="6" colSpan="4" class="icon-btn" variant="text" :text="'mdi-sunglasses'" @tap="$emit('tap', $event)" @longPress="onLongGlassesButton" />
        <Label isUserInteractionEnabled="false" :backgroundColor="glasses ? '#53da22' : '#ed243e'" borderRadius="4.5" row="2" col="2" />
        <GridLayout :columns="glassesBatteryColumns" backgroundColor="#E4E4E4" width="24" borderRadius="1" height="4" row="4" col="1" colSpan="2">
            <AbsoluteLayout col="0" :backgroundColor="glassBatteryColor" />
        </GridLayout>
        <Label isUserInteractionEnabled="false" horizontalAlignment="center" fontSize="7" fontWeight="bold" :text="battery + '%'" row="5" col="1" colSpan="2" />
    </GridLayout>
</template>

<script lang="ts">
import { GestureEventData } from '@nativescript/core/ui';
import { Component, Prop } from 'vue-property-decorator';
import { GlassesDevice } from '~/handlers/bluetooth/GlassesDevice';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class GlassesIcon extends BaseVueComponent {
    @Prop({ default: 0, type: Number })
    public battery: number;

    @Prop({ default: null })
    public glasses: GlassesDevice;

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

    onGlassesButton() {
        this.$emit('tapGlass');
    }
    onLongGlassesButton(args: GestureEventData) {
        if (__IOS__ && args && args.ios && args.ios.state !== 3) {
            return;
        }
        this.$emit('longPress', args);
    }
}
</script>
