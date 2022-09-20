<template>
    <Page actionBarHidden ref="page" ios:barStyle="light">
        <GridLayout rows="auto,*">
            <CActionBar :title="$t('explorer')" :showMenuIcon="false" />
            <CollectionView row="1" :items="devices" rowHeight="50">
                <v-template>
                    <ListItem :title="item.localName || $tc('unknown_device')" @tap="onItemTap(item, $event)" />
                </v-template>
            </CollectionView>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { AdvertismentData, Peripheral as IPeripheral } from '@nativescript-community/ble';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { ItemEventData } from '@nativescript/core/ui/list-view';
import { Component, Prop } from 'vue-property-decorator';
import { MICROOLED_MANUFACTURER_ID, MICROOLED_MANUFACTURER_NAME, StartScanningOptions } from '~/handlers/BluetoothHandler';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class Explorer extends BaseVueComponent {
    @Prop({})
    title: string;
    mounted() {
        super.mounted();
    }

    destroyed() {
        super.destroyed();
    }

    public onItemTap(args: ItemEventData) {}
}
</script>
