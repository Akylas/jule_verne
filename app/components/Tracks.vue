<template>
    <Page ref="page" id="tracks" :navigateUrl="navigateUrl" @navigatingTo="onNavigatingTo">
        <GridLayout rows="auto,*">
            <CActionBar :title="title" :showMenuIcon="!inSelection" :disableBackButton="inSelection">
                <StackLayout verticalAlignment="center" orientation="horizontal">
                    <!-- <MDButton variant="text" class="icon-btn" :text="'mdi-plus'" @tap="createTrack" v-if="!inSelection" /> -->
                    <!-- <MDButton variant="text" class="icon-btn" :text="'mdi-file-import'" @tap="importTrace" v-if="!inSelection" /> -->
                    <!-- <MDButton v-show="inSelection" variant="text" class="icon-btn" :text="'mdi-delete'" @tap="deleteSelectedSessions" /> -->
                </StackLayout>
                <MDButton v-if="inSelection" slot="left" variant="text" class="icon-btn" :text="'mdi-close'" @tap="unselectAllSessions" />
            </CActionBar>
            <CollectionView ref="collectionView" row="1" :items="dataItems" rowHeight="70">
                <v-template>
                    <ListItem
                        showChecked="true"
                        :title="itemTitle(item)"
                        :subtitle="itemSubtitle(item)"
                        :checked="item.checked"
                        :selected="isTrackSelected(item)"
                        @tap="onItemTap(item, $event)"
                        @checkedChange="onTrackChecked(item, $event)"
                        @longPress="onItemLongPress(item, $event)"
                    />
                </v-template>
            </CollectionView>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { CollectionView } from '@nativescript-community/ui-collectionview';
import { openFilePicker } from '@nativescript-community/ui-document-picker';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { getString } from '@nativescript/core/application-settings';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { knownFolders, path } from '@nativescript/core/file-system';
import { profile } from '@nativescript/core/profiling';
import { Component, Prop } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import OptionSelect from '~/components/OptionSelect';
import TrackDetails from '~/components/TrackDetails.vue';
import Track from '~/models/Track';
import { Catch } from '~/utils';
import { ComponentIds } from '~/vue.prototype';

interface Item {
    track: Track;
    selected: boolean;
    checked: boolean;
}

// @EventSubscriber()
@Component({
    components: {
        TrackDetails
    }
})
export default class Tracks extends BgServiceComponent {
    navigateUrl = ComponentIds.Tracks;

    @Prop({ type: Boolean, default: true }) allowEdit: boolean;

    dataItems: ObservableArray<Item> = null;
    item: Item;

    get listView() {
        return this.$refs.collectionView && (this.$refs.collectionView.nativeView as CollectionView);
    }

    onNavigatingTo() {
        if (this.needsRefreshOnNav) {
            this.needsRefreshOnNav = false;
            this.listView.refresh();
        }
    }

    needsRefreshOnNav = false;

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    get title() {
        if (this.inSelection) {
            return this.$t('selected_items', this.selectedSessions.length);
        }
        return this.$t('tracks');
    }
    get isTrackSelected() {
        return (item: Item) => !!item.selected;
    }
    get isCurrentTrack() {
        return (item: Item) => !!item.checked;
    }

    selectTrack(item: Item, selected: boolean) {
        const trackId = item.track.id;
        if (selected) {
            if (trackId !== this.currentTrackId) {
                if (this.currentTrackId) {
                    this.dataItems.some((t, index) => {
                        if (t.track.id === this.currentTrackId) {
                            this.setChecked(t, false);
                            return true;
                        }
                        return false;
                    });
                }
                this.setChecked(item, true);
                this.storyHandler.currentTrack = item.track;
                this.currentTrackId = trackId;
            }
        } else {
            if (this.currentTrackId === trackId) {
                this.setChecked(item, false);
                this.storyHandler.currentTrack = null;
                this.currentTrackId = null;
            }
        }
    }
    onTrackChecked(item: Item, $event) {
        this.selectTrack(item, $event.value);
    }
    currentTrackId: string;
    get inSelection() {
        return this.selectedSessions.length > 0;
    }

    selectSession(item: Item) {
        if (!this.isTrackSelected(item)) {
            this.dataItems.some((d, index) => {
                if (d === item) {
                    d.selected = true;
                    this.dataItems.setItem(index, d);
                    return true;
                }
            });
        }
    }
    setChecked(item: Item, checked: boolean) {
        this.dataItems.some((d, index) => {
            if (d === item) {
                d.checked = checked;
                this.dataItems.setItem(index, d);
                return true;
            }
        });
    }
    unselectSession(item: Item) {
        if (this.isTrackSelected(item)) {
            this.dataItems.some((d, index) => {
                if (d === item) {
                    d.selected = false;
                    this.dataItems.setItem(index, d);
                    return true;
                }
            });
        }
    }
    unselectAllSessions() {
        this.dataItems &&
            this.dataItems.forEach((d, index) => {
                d.selected = false;
                this.dataItems.setItem(index, d);
            });
    }

    get selectedSessions() {
        return this.dataItems?.filter((s) => !!s.selected).map((i) => i.track.id) || [];
    }
    get itemTitle() {
        return (item: Item) => {
            const session = item.track;
            return session.name;
        };
    }

    get itemSubtitle() {
        return (item: Item) => {
            const session = item.track;
            return '';
        };
    }

    @Catch()
    async refresh() {
        const results = await this.dbHandler.trackRepository.searchItem();
        const selectedTrack = (this.currentTrackId = getString('selectedTrackId'));
        this.dataItems = new ObservableArray(
            results.map((s) => ({
                track: s,
                checked: selectedTrack === s.id,
                selected: false
            }))
        );
        DEV_LOG && console.log('Tracks', 'refresh', this.dataItems);
    }

    ignoreTap = false;
    onItemLongPress(item: Item, event?) {
        if (this.allowEdit && event && event.ios && event.ios.state !== 1) {
            return;
        }
        if (event && event.ios) {
            this.ignoreTap = true;
        }
        if (this.isTrackSelected(item)) {
            this.unselectSession(item);
        } else {
            this.selectSession(item);
        }
    }
    onItemTap(item: Item, event) {
        if (this.ignoreTap) {
            this.ignoreTap = false;
            return;
        }
        if (this.selectedSessions.length > 0) {
            this.onItemLongPress(item);
        } else {
            if (this.allowEdit) {
                this.$navigateTo(TrackDetails, { props: { track: item.track } });
            } else {
                this.selectTrack(item, !item.selected);
            }
        }
    }

    onServiceLoaded(handlers: BgServiceMethodParams) {
        this.refresh();
    }
    @Catch()
    async importTrace() {
        let result;
        if (__IOS__) {
            const docs = knownFolders.documents();
            result = await docs
                .getEntities()
                .then((result) => result.map((e) => e.path).filter((s) => s.endsWith('.gpx') || s.endsWith('.json')))
                .then((r) => {
                    if (r && r.length > 0) {
                        return this.$showModal(OptionSelect, {
                            props: {
                                title: this.$t('pick_file'),
                                options: r.map((e) => ({ title: e.split('/').slice(-1)[0], data: e }))
                            },
                            fullscreen: false
                        }).then((result: { title: string; data: string }) => result && { files: [result.data] });
                    } else {
                        showSnack({ message: this.$t('no_file_found') });
                        return undefined;
                    }
                });
        } else {
            result = await openFilePicker({
                extensions: __IOS__ ? ['com.akylas.juleverne.json', 'com.gpsakylas.julevernetest.gpx'] : ['*/*'],
                multipleSelection: false,
                pickerMode: 0
            });
        }
        if (result && result.files.length > 0) {
            this.showLoading(this.$t('importing'));
            await Promise.all(
                result.files.map((f) => {
                    if (f.endsWith('.json')) {
                        return this.storyHandler.importJSONFile(f);
                        // } else if (f.endsWith('.gpx')) {
                        // return this.geoHandler.importGPXFile(f);
                    }
                })
            );
            this.hideLoading();
            this.refresh();
        }
    }

    async shareDB() {
        const filePath = path.join(knownFolders.documents().getFolder('db').path, 'db.sqlite');
        const shareFile = new ShareFile();
        await shareFile.open({
            path: filePath,
            title: 'DB',
            options: true, // optional iOS
            animated: true // optional iOS
        });
    }

    // async createTrack() {
    //     const result = await this.$showModal(Leaflet, {
    //         fullscreen: true
    //     });
    //     if (result) {
    //         const data = JSON.parse(result) as TrackFeatureCollection;
    //         const track = new Track(Date.now());
    //         Object.assign(track, data);
    //         const geojson = bboxify(track.geometry);
    //         track.geometry = geojson as any;
    //         track.bounds = new MapBounds<LatLonKeys>({ lat: geojson.bbox[3], lon: geojson.bbox[2] }, { lat: geojson.bbox[1], lon: geojson.bbox[0] });
    //         await track.save();
    //         this.$getAppComponent().navigateTo(TrackDetails, { props: { track } });
    //     }
    // }
}
</script>
