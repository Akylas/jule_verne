<template>
    <Page ref="page" id="history" :navigateUrl="navigateUrl" backgroundColor="black">
        <GridLayout rows="auto,*, auto">
            <CActionBar :title="$t('images')" showMenuIcon />
            <Pager row="1" v-model="currentIndex" :items="items">
                <v-template>
                    <GridLayout>
                        <NSZoomImg :src="item.path" stretch="aspectFit" :colorMatrix="colorMatrix" />

                        <Label :text="item.name" verticalTextAlignment="bottom" fontSize="12" color="white" backgroundColor="#00000088" verticalAlignment="bottom" />
                    </GridLayout>
                </v-template>
            </Pager>
            <CollectionView ref="collectionView" row="2" height="70" orientation="horizontal" colWidth="83" :items="items" @loaded="onLoaded">
                <v-template>
                    <GridLayout>
                        <Image :src="item.path" stretch="aspectFit" :colorMatrix="colorMatrix" :borderColor="item.selected ? accentColor : 'transparent'" borderWidth="1" @tap="showImage(item)" />
                    </GridLayout>
                </v-template>
            </CollectionView>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { CollectionView } from '@nativescript-community/ui-collectionview';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { backgroundColor, textColor } from '~/variables';
import { ComponentIds } from '~/vue.prototype';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import BaseVueComponent from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';

interface Image {
    type: 'image';
    parent: string;
    name: string;
    path: string;
}
interface Item extends Image {
    selected: boolean;
}
@Component({})
export default class ImagesViewer extends BgServiceComponent {
    navigateUrl = ComponentIds.ImagesViewer;
    colorMatrix = IMAGE_COLORMATRIX;

    backgroundColor = backgroundColor;
    textColor = textColor;

    @Prop() images: Image[];
    @Prop() startIndex: number;

    items: ObservableArray<Item> = null;
    currentIndex: number = 0;
    lastIndex = -1;

    item: Item;

    constructor() {
        super();
        this.items = new ObservableArray(this.images.map((item, i) => ({ ...item, selected: i === this.startIndex })));
        this.currentIndex = this.startIndex;
        this.lastIndex = this.startIndex;
        console.log('mounted', this.items.length, this.currentIndex);
    }
    @Watch('currentIndex')
    onIndexChange() {
        if (this.lastIndex === this.currentIndex) {
            return;
        }
        if (this.lastIndex !== -1) {
            this.items.setItem(this.lastIndex, { ...this.items.getItem(this.lastIndex), selected: false });
        }
        const item = this.items.getItem(this.currentIndex);
        this.items.setItem(this.currentIndex, { ...item, selected: true });
        this.lastIndex = this.currentIndex;
        this.bluetoothHandler.drawImageFromPathWithMire(item.path);
        this.getRef<CollectionView>('collectionView').scrollToIndex(this.currentIndex, true);
    }

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    onLoaded() {
        this.getRef<CollectionView>('collectionView').scrollToIndex(this.currentIndex, false);
    }

    showImage(item: Item) {
        const index = this.items.findIndex((i) => i.path === item.path);
        if (index > -1) {
            this.currentIndex = index;
        }
    }
}
</script>
