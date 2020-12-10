<template>
    <WebViewExt ref="webview" src="~/assets/editor/index.html" @loadFinished="onWebViewLoaded" />
</template>

<script lang="ts">
import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { WebViewExt } from '@nota/nativescript-webview-ext';
import { ComponentIds } from './App';
import Track from '~/models/Track';
@Component({})
export default class Editor extends BaseVueComponent {
    @Prop()
    track: Track;
    get webView() {
        return this.getRef<WebViewExt>('webview');
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    onWebViewLoaded() {
        this.setCode(JSON.stringify(this.track.geometry, null, 4));
        this.setLang('json');
        this.setTheme('monokai');
    }
    setCode(code) {
        this.webView.executeJavaScript('setSource' + '(' + JSON.stringify({ data: code }) + ')', null);
    }
    setLang(lang) {
        this.webView.executeJavaScript(`changeLanguage('${lang}')`, null);
    }

    setTheme(theme) {
        this.webView.executeJavaScript(`changeStyle('${theme}')`, null);
    }
}
</script>
