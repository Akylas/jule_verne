<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <GridLayout rows="auto,*">
            <CActionBar showMenuIcon :title="$tc('create_track')" />
            <WebViewExt ref="webview" row="1" src="~/assets/leaflet/index.html" @geojson="onGeoJSON" />
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { WebViewExt } from '@nota/nativescript-webview-ext';
import { ComponentIds } from './App';
@Component({})
export default class Leaflet extends BaseVueComponent {
    navigateUrl = ComponentIds.Leaflet;
    get webView() {
        return this.getRef<WebViewExt>('webview');
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    onGeoJSON(event) {
        console.log('onGeoJSON', event.data);
    }
}
</script>
