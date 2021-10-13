<template>
    <Page ref="page" :actionBarHidden="true">
        <StackLayout>
            <CActionBar :title="$t('images')" showMenuIcon />
            <CollectionView :items="images" colWidth="50%">
                <v-template>
                    <Image :src="item" />
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { Folder, knownFolders, path } from '@nativescript/core';
import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';

async function getImagesInFolder(folder: string, images: string[] = []) {
    const entities = await Folder.fromPath(folder).getEntities();
    for (let index = 0; index < entities.length; index++) {
        const e = entities[index];
        if (Folder.exists(e.path)) {
            await getImagesInFolder(e.path, images);
        } else if (e.name.endsWith('.png') || e.name.endsWith('.jpg') || e.name.endsWith('.bmp')) {
            images.push(e.path);
        }
    }
    return images;
}
@Component({})
export default class ImagesView extends BaseVueComponent {
    images = null;
    mounted() {
        (async () => {
            const imagesFolder = path.join(knownFolders.currentApp().path, '/assets/data/glasses_images');
            this.images = await getImagesInFolder(imagesFolder);
            console.log('ImagesView', imagesFolder, this.images);
        })();
    }
}
</script>
