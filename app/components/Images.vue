<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('images')" :subtitle="folder" showMenuIcon />
            <CollectionView :items="items" spanCount="2" colWidth="50%" :spanSize="(item) => (item.type === 'image' ? 1 : 2)">
                <v-template if="item.type === 'folder'">
                    <Label
                        :text="item.name"
                        :rippleColor="accentColor"
                        @tap="onItemTap(item)"
                        height="80"
                        padding="12"
                        verticalTextAlignment="center"
                        fontSize="20"
                        :borderBottomColor="borderColor"
                        borderBottomWidth="1"
                    />
                </v-template>
                <v-template if="item.type === 'image'">
                    <GridLayout>
                        <NSImg :src="item.path" @tap="onItemTap(item)" stretch="aspectFill" :colorMatrix="colorMatrix" height="200" backgroundColor="black" decodeWidth="400" decodeHeight="400" />
                        <Label :text="item.name" verticalTextAlignment="bottom" fontSize="14" color="white" backgroundColor="#00000088" verticalAlignment="bottom" />
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { ApplicationSettings, Folder, knownFolders, path } from '@nativescript/core';
import { Component, Prop } from 'vue-property-decorator';
import { CommandType, FULLSCREEN, InputCommandType } from '~/handlers/Message';
import { Catch } from '~/utils';
import { getGlassesImagesFolder } from '~/utils/utils';
import { borderColor, textColor } from '~/variables';
import { IMAGE_COLORMATRIX } from '~/vue.views';
import BaseVueComponent from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';

interface Item {
    type: 'image' | 'folder';
    parent: string;
    name: string;
    path: string;
}

async function getImagesAndFolder(folderStr: string) {
    const folder = Folder.fromPath(folderStr);
    const entities = await Folder.fromPath(folderStr).getEntities();
    const images = [];
    const folders = [];

    for (let index = 0; index < entities.length; index++) {
        const e = entities[index];
        if (Folder.exists(e.path)) {
            folders.push({
                type: 'folder',
                name: e.name,
                path: e.path
            });
        } else if (e.name.endsWith('.png') || e.name.endsWith('.jpg') || e.name.endsWith('.bmp')) {
            images.push({
                type: 'image',
                parent: folder.name,
                name: e.name,
                path: e.path
            });
        }
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name)).concat(images.sort((a, b) => a.name.localeCompare(b.name)));
}
@Component({})
export default class ImagesView extends BgServiceComponent {
    textColor = textColor;
    borderColor = borderColor;
    items: Item[] = null;
    item: Item;
    colorMatrix = IMAGE_COLORMATRIX;

    @Prop({ type: String, default: getGlassesImagesFolder() }) folder;
    mounted() {
        super.mounted();
        (async () => {
            this.items = await getImagesAndFolder(this.folder);
        })();
    }
    destroyed() {
        super.destroyed();
    }

    @Catch()
    async onItemTap(item) {
        switch (item.type) {
            case 'image': {
                this.storyHandler.drawImageFromPathWithMire(item.path);
                const component = (await import('~/components/ImagesViewer.vue')).default;
                const index = this.items.findIndex((i) => i.path === item.path);
                this.$navigateTo(component, {
                    props: {
                        images: this.items,
                        startIndex: index
                    }
                });
                break;
            }
            case 'folder': {
                const component = (await import('~/components/Images.vue')).default;
                this.$navigateTo(component, {
                    props: {
                        folder: item.path
                    }
                });
            }
        }
    }

    @Catch()
    async onLongPress(item: Item) {
        const OptionSelect = (await import('~/components/OptionSelect.vue')).default;
        const result = await this.$showBottomSheet(OptionSelect, {
            ignoreTopSafeArea: true,
            props: {
                showCancel: false,
                options: [
                    {
                        id: 'set_as_config_image',
                        title: this.$tc('set_as_config_image')
                    }
                ]
            },
            trackingScrollView: 'collectionView'
        });
        if (result) {
            switch (result.id) {
                case 'set_as_config_image':
                    ApplicationSettings.setString('glasses_config_image', item.path);
                    break;
            }
        }
    }
}
</script>
