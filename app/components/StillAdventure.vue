<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('still_adventure')" />
            <CollectionView :items="items" rowHeight="110">
                <v-template>
                    <GridLayout>
                        <GridLayout
                            margin="10 20 10 20"
                            borderRadius="10"
                            :borderColor="accentColor"
                            borderWidth="1"
                            columns="130,*"
                            @tap="() => onItemTap(item)"
                            :rippleColor="accentColor"
                            :backgroundColor="themeColor"
                        >
                            <Image :src="item.cover" stretch="aspectFill" borderRadius="10 0 0 10" :colorMatrix="colorMatrix" />
                            <Label col="1" :text="item.name" verticalTextAlignment="center" fontSize="20" padding="10" fontWeight="800" color="black" />
                        </GridLayout>
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { Folder, path } from '@nativescript/core';
import { Component } from 'vue-property-decorator';
import { Catch } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { textColor } from '~/variables';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import BgServiceComponent from './BgServiceComponent';

interface Item {
    id: string;
    name: string;
    cover: string;
    path: string;
}

@Component({})
export default class StillAdventure extends BgServiceComponent {
    textColor = textColor;
    colorMatrix = IMAGE_COLORMATRIX;
    items: Item[] = null;
    item: Item;

    mounted() {
        super.mounted();
        this.refresh();
    }
    destroyed() {
        super.destroyed();
    }

    @Catch()
    async refresh() {
        const stories = await Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories')).getEntities();
        this.items = stories
            .map((s) => {
                if ((PRODUCTION && s.name === '1000') || !Folder.exists(s.path)) {
                    return;
                }

                const metadata = this.bluetoothHandler.storyInfo(s.name);
                return {
                    name: metadata.title,
                    id: s.name,
                    path: s.path,
                    cover: path.join(s.path, metadata.cover)
                };
            })
            .filter((s) => !!s);
        console.log('items', this.items);
    }

    @Catch()
    async onItemTap(item: Item) {
        console.log('onItemTap', item);
        await this.geoHandler.loadAndPlayStory({ storyIndex: +item.id, shouldPlayStart: false, shouldPlayMusic: true, shouldPlayRideau: false, canStop: true });
    }
}
</script>
