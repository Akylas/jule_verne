<template>
    <GridLayout rows="auto,auto" columns="auto,*" padding="20">
        <MDActivityIndicator col="0" class="activity-indicator" busy />
        <Label col="1" paddingLeft="15" fontSize="16" verticalAlignment="middle" textWrap />
        <MDProgress row="1" colSpan="2" maxValue="100" :color="accentColor" />
    </GridLayout>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
@Component({})
export default class LoadingIndicator extends BaseVueComponent {}
</script>
