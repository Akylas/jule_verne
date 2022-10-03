<template>
    <CanvasView :height="radius * 2 + 2" :width="count * spacing + spacing" v-show="count > 1" ref="canvas">
        <Circle v-for="(n, index) in count" :key="index" :fillColor="textColor" :radius="radius" top="5" :left="spacing * index + spacing" />
        <Circle :fillColor="selectedColor" :radius="radius" top="5" :left="spacing * actualIndex + spacing" />
    </CanvasView>
</template>
<script lang="ts">
import { AdditiveTweening } from 'additween';
import Vue, { NativeScriptVue } from 'nativescript-vue';
import { CanvasView } from '@nativescript-community/ui-canvas';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { accentColor, textColor } from '../variables';
import { CoreTypes } from '@nativescript/core/core-types';

@Component({
    components: {}
})
export default class PageIndicator extends Vue {
    accentColor = accentColor;
    textColor = textColor;
    @Prop({ default: () => accentColor }) selectedColor: number;
    @Prop({ type: Number }) count: number;
    @Prop({ type: Number, default: 5 }) radius: number;
    @Prop({ type: Number, default: 20 }) spacing: number;
    @Prop({ type: Number }) selectedIndex: number;

    actualIndex: number = 0;

    mounted() {
        this.actualIndex = this.selectedIndex;
    }
    @Watch('selectedIndex')
    onSelectedIndexChange() {
        const anim = new AdditiveTweening({
            onRender: (obj) => (this.actualIndex = obj.value),
            onFinish: () => (this.actualIndex = this.selectedIndex),
            onCancel: () => (this.actualIndex = this.selectedIndex)
        });
        anim.tween({ value: this.actualIndex }, { value: this.selectedIndex }, 100, (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2));
    }
}
</script>
