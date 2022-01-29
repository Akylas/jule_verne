<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <GridLayout rows="auto,*">
            <CActionBar modal showMenuIcon :title="$tc('create_track')" />
            <AWebView ref="webview" row="1" src="~/assets/leaflet/index.html" @geojson="onGeoJSON" normalizeUrls="false" />
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { AWebView } from '@nativescript-community/ui-webview';
import { ComponentIds } from './App';
@Component({})
export default class Leaflet extends BaseVueComponent {
    get webView() {
        return this.getRef<AWebView>('webview');
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
