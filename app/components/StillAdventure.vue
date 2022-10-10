<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('still_adventure')" />
            <CollectionView :items="items" rowHeight="130">
                <v-template>
                    <GridLayout @tap="() => onItemTap(item)" :rippleColor="accentColor">
                        <GridLayout margin="20" columns="auto,*">
                            <Image borderRadius="8" :src="item.cover" stretch="aspectFill" />
                            <Label col="1" margin="0 0 0 14" verticalTextAlignment="center">
                                <Span fontSize="18" fontWeight="800" :text="item.title" />
                                <Span fontSize="16" :text="'\n' + item.description" />
                                <Span fontSize="14" :text="'\n' + '\n' + formatDuration(item.audioDuration)" />
                            </Label>
                            <Label
                                col="1"
                                verticalAlignment="bottom"
                                horizontalAlignment="right"
                                :backgroundColor="accentColor"
                                height="24"
                                fontSize="14"
                                borderRadius="12"
                                marginRight="10"
                                padding="3 2 0 8"
                            >
                                <Span :text="$tc('play') + ' '" fontWeight="500" verticalAlignment="center" />
                                <Span :fontFamily="mdiFontFamily" text="mdi-play" fontSize="22" verticalAlignment="center" />
                            </Label>
                        </GridLayout>
                        <AbsoluteLayout height="1" :backgroundColor="borderColor" margin="0 80 0 70" verticalAlignment="bottom" />
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { Folder, path } from '@nativescript/core';
import dayjs from 'dayjs';
import { Component } from 'vue-property-decorator';
import { Catch } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { borderColor, mdiFontFamily, textColor } from '~/variables';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import BgServiceComponent from './BgServiceComponent';

interface Item {
    id: string;
    title: string;
    description: string;
    audioDuration: number;
    cover: string;
    path: string;
}

@Component({})
export default class StillAdventure extends BgServiceComponent {
    textColor = textColor;
    borderColor = borderColor;
    mdiFontFamily = mdiFontFamily;
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

    formatDuration(data = 0) {
        return dayjs.duration(data).format('m [minutes]');
    }

    @Catch()
    async refresh() {
        const stories = await Folder.fromPath(path.join(getGlassesImagesFolder(), 'stories')).getEntities();
        this.items = stories
            .map((s) => {
                if (!Folder.exists(s.path)) {
                    // if ((PRODUCTION && s.name === '1000') || !Folder.exists(s.path)) {
                    return;
                }

                const metadata = this.bluetoothHandler.storyInfo(s.name);
                return {
                    ...metadata,
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
        console.log('onItemTap', item.id, this.bluetoothHandler.isPlaying, this.bluetoothHandler.isPlayingStory, this.bluetoothHandler.isPlayingPastille);

        if (!this.bluetoothHandler.isPlaying) {
            await this.bluetoothHandler.loadAndPlayStory({ storyIndex: +item.id, shouldPlayStart: false, shouldPlayMusic: true, shouldPlayRideau: false, canStop: true, markAsPlayedOnMap:false });
        }
    }
}
</script>
