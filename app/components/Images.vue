<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('images')" showMenuIcon />
            <CollectionView :items="items" spanCount="2" colWidth="50%" :spanSize="(item) => (item.type === 'image' ? 1 : 2)">
                <v-template if="item.type === 'folder'">
                    <Label
                        :text="item.name"
                        :rippleColor="accentColor"
                        @tap="onItemTap(item)"
                        height="60"
                        padding="12"
                        verticalTextAlignment="center"
                        fontSize="20"
                        :borderBottomColor="textColor"
                        borderBottomWidth="1"
                    />
                </v-template>
                <v-template if="item.type === 'image'">
                    <GridLayout>
                    <Image :src="item.path" @tap="onItemTap(item)" backgroundColor="red" stretch="aspectFit" />
                     <Label
                        :text="item.name"
                        verticalTextAlignment="bottom"
                        fontSize="12"
                        color="white"
                    />
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { Folder, knownFolders, path } from '@nativescript/core';
import { Component, Prop } from 'vue-property-decorator';
import { CommandType, FULLSCREEN, InputCommandType } from '~/handlers/Message';
import { getGlassesImagesFolder } from '~/utils/utils';
import { textColor } from '~/variables';
import BaseVueComponent from './BaseVueComponent';
import BgServiceComponent from './BgServiceComponent';

interface Item {
    type: 'image' | 'folder',
                name: string,
                path: string
}

async function getImagesAndFolder(folder: string) {
    const entities = await Folder.fromPath(folder).getEntities();
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
    items:Item[] = null;
    item:Item;

    @Prop({ type: String }) folder;
    mounted() {
        super.mounted();
        (async () => {
            this.items = await getImagesAndFolder(this.folder || getGlassesImagesFolder());
        })();
    }
    destroyed() {
        super.destroyed();
    }

    async onItemTap(item) {
        try {
            switch (item.type) {
                case 'image':
                    const useCrop = this.bluetoothHandler.setUsesCrop('navigation');
                    const navImages = this.bluetoothHandler.navigationImageMap;
                    const commands: { commandType: CommandType; params?: InputCommandType<any> }[] = [];
                    const cleaned = item.name.split('.')[0];
                    console.log('drawing image', item.type, item.name, useCrop , navImages[cleaned])
                    if (useCrop) {
                        commands.push(
                            {
                                commandType: CommandType.HoldFlushw,
                                params: [0]
                            },
                            {
                                commandType: CommandType.Color,
                                params: [0]
                            },
                            {
                                commandType: CommandType.Rectf,
                                params: FULLSCREEN
                            }
                        );
                    }

                    if (navImages[cleaned]) {
                        commands.push({
                            commandType: CommandType.cfgSet,
                            params: { name: 'nav' }
                        });
                        const data = navImages[cleaned];
                        commands.push({
                            commandType: CommandType.imgDisplay,
                            params: data.slice(0, 3)
                        });
                    } else {
                        const array = this.folder.split('/');
                        const cfgId = array[array.length - 2];
                        const imagesMap = this.bluetoothHandler.storyImageMap(cfgId);
                        if (imagesMap[cleaned]) {
                            commands.push({
                                commandType: CommandType.cfgSet,
                                params: { name: cfgId }
                            });
                            commands.push({
                                commandType: CommandType.imgDisplay,
                                params: imagesMap[cleaned]
                            });
                        }
                    }
                    if (useCrop) {
                        commands.push({
                            commandType: CommandType.HoldFlushw,
                            params: [1]
                        });
                    }
                    this.bluetoothHandler.sendCommands(commands);
                    // } else {
                    //     console.error('image missing', cleaned);
                    // }

                    break;
                case 'folder':
                    const component = (await import('~/components/Images.vue')).default;
                    this.$navigateTo(component, {
                        props: {
                            folder: item.path
                        }
                    });
            }
        } catch (err) {
            this.showError(err);
        }
    }
}
</script>
