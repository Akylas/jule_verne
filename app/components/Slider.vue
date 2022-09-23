<template>
    <CanvasView :id="id" :height="height" ref="canvas" @draw="onDraw" @touch="onTouch"> </CanvasView>
</template>
<script lang="ts">
import { Utils } from '@akylas/nativescript';
import { Align, Canvas, CanvasView, Direction, Paint, Path } from '@nativescript-community/ui-canvas';
import { Color } from '@nativescript/core/color';
import { TouchGestureEventData, View } from '@nativescript/core/ui';
import Vue from 'nativescript-vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { accentColor, mdiFontFamily } from '../variables';

const paint = new Paint();
paint.setColor(accentColor);
const iconPaint = new Paint();
iconPaint.setColor('white');
iconPaint.setFontFamily(mdiFontFamily);
iconPaint.setTextSize(30);
iconPaint.setTextAlign(Align.RIGHT);
@Component({
    components: {}
})
export default class Slider extends Vue {
    accentColor = accentColor;
    @Prop({ default: accentColor }) color: number | Color | string;
    @Prop({ type: Number, default: 25 }) radius: number;
    @Prop({ type: Number, default: 50 }) height: number;
    @Prop({ type: Number, default: 50 }) value: number;
    @Prop({ type: Number, default: 100 }) maxValue: number;
    @Prop({ type: Number, default: 0 }) minValue: number;
    @Prop({ type: String }) icon: string;
    @Prop({ type: String }) id: string;

    mounted() {
        console.log('Slider', this.id, this.value);
        this.mValue = this.value;
    }
    @Watch('value')
    onValueChanged() {
        console.log('onValueChanged', this.id, this.value);
        this.mValue = this.value;
        this.nativeView.invalidate();
    }
    nativeView: CanvasView;
    mValue: number = null;
    onDraw(event) {
        const canvas = event.canvas as Canvas;
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        paint.setColor(this.color);
        const path = new Path();
        path.addRoundRect(0, 0, w, h, this.radius, this.radius, Direction.CCW);
        paint.setAlpha(80);
        canvas.clipPath(path);
        canvas.drawRect(0, 0, w, h, paint);
        paint.setAlpha(255);
        const ratio = (this.mValue - this.minValue) / (this.maxValue - this.minValue);
        canvas.drawRect(0, 0, w * ratio, h, paint);

        if (this.icon) {
            canvas.drawText(this.icon, w - 15, h / 2 + 10, iconPaint);
        }
    }
    onTouch(e: TouchGestureEventData) {
        if (e.action === 'down' || e.action === 'move') {
            const ratio = e.getX() / Utils.layout.toDeviceIndependentPixels((e.object as View).getMeasuredWidth());
            this.mValue = this.minValue + (this.maxValue - this.minValue) * ratio;
            this.$emit('valueChange', { value: this.mValue });
            this.nativeView.invalidate();
        }
    }
}
</script>
