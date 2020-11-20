import { installMixins } from '@nativescript-community/ui-material-core';
installMixins();

import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
installBottomSheets();
import ActivityIndicatorPlugin from '@nativescript-community/ui-material-activityindicator/vue';
import BottomSheetPlugin from '@nativescript-community/ui-material-bottomsheet/vue';
import ButtonPlugin from '@nativescript-community/ui-material-button/vue';
import CardViewPlugin from '@nativescript-community/ui-material-cardview/vue';
import ProgressPlugin from '@nativescript-community/ui-material-progress/vue';
import TextFieldPlugin from '@nativescript-community/ui-material-textfield/vue';
import SliderPlugin from '@nativescript-community/ui-material-slider/vue';
// import NativescriptVue from 'nativescript-vue';
import CActionBar from '~/components/CActionBar';
import ListItem from '~/components/ListItem';
import CanvasPlugin from '@nativescript-community/ui-canvas/vue';
import CanvasLabelPlugin from '@nativescript-community/ui-canvaslabel/vue';
import CollectionViewPlugin from '@nativescript-community/ui-collectionview/vue';
import CartoPlugin from '@nativescript-community/ui-carto/vue';
import PagerPlugin from '@nativescript-community/ui-pager/vue';
import DrawerPlugin from '@nativescript-community/ui-drawer/vue';

const Plugin = {
    install(Vue) {
        console.log('installing view components');
        Vue.component('CActionBar', CActionBar);
        Vue.component('ListItem', ListItem);
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        Vue.use(CardViewPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(SliderPlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(BottomSheetPlugin);

        Vue.use(CanvasPlugin);
        Vue.use(CanvasLabelPlugin);
        Vue.use(CollectionViewPlugin);
        Vue.use(CartoPlugin);
        Vue.use(PagerPlugin);
        Vue.use(DrawerPlugin);

        Vue.registerElement('WebViewExt', () => require('@nota/nativescript-webview-ext').WebViewExt);
        Vue.registerElement('LineChart', () => require('@nativescript-community/ui-chart/charts/LineChart').LineChart);
        Vue.registerElement('CheckBox', () => require('@nstudio/nativescript-checkbox').CheckBox, {
            model: {
                prop: 'checked',
                event: 'checkedChange'
            }
        });
    }
};

export default Plugin;
