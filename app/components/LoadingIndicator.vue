<template>
    <GridLayout rows="auto,auto,auto" columns="auto,*" padding="20">
        <Label colSpan="2" v-show="title" padding="10" fontSize="20" fontWeight="bold" verticalAlignment="middle" :text="title" textWrap="true" />
        <MDActivityIndicator row="1" class="activity-indicator" busy v-show="progress === null" />
        <Label col="1" row="1" padding="10" fontSize="16" verticalAlignment="middle" :text="text" textWrap="true" />
        <MDProgress row="2" colSpan="2" maxValue="100" :color="accentColor" :value="progress" v-show="progress !== null"/>
        <MDButton row="3" colSpan="2" horizontalAlignment="right" v-show="showButton" @tap="onButtonTap" />
    </GridLayout>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
@Component({})
export default class LoadingIndicator extends BaseVueComponent {
    showButton = false;
    title = null;
    text = null;
    progress = null;
    onButtonTap() {
        this.$emit('tap');
    }
}
</script>
