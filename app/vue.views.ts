import { installMixins } from '@nativescript-community/ui-material-core';
installMixins();
import { overrideSpanAndFormattedString } from '@nativescript-community/text'; // require first to get Font res loading override
overrideSpanAndFormattedString();
import { installMixins as installColorFilters } from '@nativescript-community/ui-image-colorfilter';
installColorFilters();
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { install as installPersistentBottomSheet } from '@nativescript-community/ui-persistent-bottomsheet';
installBottomSheets();
installPersistentBottomSheet();
import ActivityIndicatorPlugin from '@nativescript-community/ui-material-activityindicator/vue';
import BottomSheetPlugin from '@nativescript-community/ui-material-bottomsheet/vue';
import ButtonPlugin from '@nativescript-community/ui-material-button/vue';
import ProgressPlugin from '@nativescript-community/ui-material-progress/vue';
import TextFieldPlugin from '@nativescript-community/ui-material-textfield/vue';
import SliderPlugin from '@nativescript-community/ui-material-slider/vue';
import CActionBar from '~/components/CActionBar.vue';
import ListItem from '~/components/ListItem.vue';
import CanvasPlugin from '@nativescript-community/ui-canvas/vue';
import CanvasLabelPlugin from '@nativescript-community/ui-canvaslabel/vue';
import CollectionViewPlugin from '@nativescript-community/ui-collectionview/vue';
import CartoPlugin from '@nativescript-community/ui-carto/vue';
import PagerPlugin from '@nativescript-community/ui-pager/vue';
import DrawerPlugin from '@nativescript-community/ui-drawer/vue';
import ImagePlugin from '@nativescript-community/ui-image/vue';
import ZoomImagePlugin from '@nativescript-community/ui-zoomimage/vue';
import PersistentBottomSheetPlugin from '@nativescript-community/ui-persistent-bottomsheet/vue';
import LottieView from '@nativescript-community/ui-lottie/vue';
import * as imageModule from '@nativescript-community/ui-image';
import { createColorMatrix } from './utils';

// export const IMAGE_COLORMATRIX = [0.9647058824, 0.9647058824, 0.9647058824, 0, 0, 0.9137254902, 0.9137254902, 0.9137254902, 0, 0, 0.1803921569, 0.1803921569, 0.180392156, 0, 0, 0, 0, 0, 1, 0];
export const IMAGE_COLORMATRIX = createColorMatrix('#E8F220');
console.log('IMAGE_COLORMATRIX', IMAGE_COLORMATRIX);
// export const IMAGE_COLORMATRIX = [0.1, 0.4, 0, 0, 0, 0.3, 1, 0.3, 0, 0, 0, 0.4, 0.1, 0, 0, 0, 0, 0, 1, 0];

const Plugin = {
    install(Vue) {
        imageModule.initialize();
        Vue.component('CActionBar', CActionBar);
        Vue.component('ListItem', ListItem);
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(BottomSheetPlugin);
        Vue.use(SliderPlugin);
        Vue.use(ImagePlugin);
        Vue.use(ZoomImagePlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(LottieView);

        Vue.use(CanvasPlugin);
        Vue.use(CanvasLabelPlugin);
        Vue.use(CollectionViewPlugin);
        Vue.use(CartoPlugin);
        Vue.use(PagerPlugin);
        Vue.use(DrawerPlugin);
        Vue.use(PersistentBottomSheetPlugin);

        Vue.registerElement('Label', () => require('@nativescript-community/ui-label').Label);
        // Vue.registerElement('Image', () => require('@nativescript-community/ui-image').Img);
        Vue.registerElement('AWebView', () => require('@nativescript-community/ui-webview').AWebView);
        Vue.registerElement('LineChart', () => require('@nativescript-community/ui-chart/charts/LineChart').LineChart);
        Vue.registerElement('CheckBox', () => require('@nativescript-community/ui-checkbox').CheckBox, {
            model: {
                prop: 'checked',
                event: 'checkedChange'
            }
        });
    }
};

export default Plugin;
