<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('still_adventure')" />
            <CollectionView :items="items" rowHeight="130">
                <v-template>
                    <StoryListItemComponent :story="item" @tap="() => onItemTap(item)" />
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
import StoryListItemComponent from './StoryListItemComponent.vue';

interface Item {
    id: string;
    title: string;
    description: string;
    audioDuration: number;
    cover: string;
    path: string;
}

@Component({
    components: { StoryListItemComponent }
})
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

                const metadata = this.storyHandler.storyInfo(s.name);
                return {
                    ...metadata,
                    id: s.name,
                    path: s.path,
                    cover: path.join(s.path, metadata.cover)
                };
            })
            .filter((s) => !!s);
    }

    @Catch()
    async onItemTap(item: Item) {
        if (!this.storyHandler.isPlaying) {
            await this.storyHandler.loadAndPlayStory({ storyIndex: +item.id, shouldPlayStart: false, shouldPlayMusic: true, shouldPlayRideau: false, canStop: true, markAsPlayedOnMap: false });
        }
    }
}
</script>
