import { CollectionView } from '@nativescript-community/ui-collectionview';
import { openFilePicker } from '@nativescript-community/ui-document-picker';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { ShareFile } from '@nativescript-community/ui-share-file';
import { getString } from '@nativescript/core/application-settings';
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { knownFolders, path } from '@nativescript/core/file-system';
import { profile } from '@nativescript/core/profiling';
import { Component } from 'vue-property-decorator';
import BgServiceComponent, { BgServiceMethodParams } from '~/components/BgServiceComponent';
import OptionSelect from '~/components/OptionSelect';
import TrackDetails from '~/components/TrackDetails';
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

    // afterInsert(event: InsertEvent<Track>) {
    //     this.dataItems = this.dataItems || new ObservableArray();
    //     this.dataItems.push({
    //         session: event.entity,
    //         selected: false
    //     });
    // }
    needsRefreshOnNav = false;
    // afterUpdate(event: UpdateEvent<Track>) {
    //     // on iOS item udpate seems to fail for now if the listview is not visible.
    //     // this is a workaround!
    //     if (__IOS__ && !this.$getAppComponent().isActiveUrl(this.navigateUrl)) {
    //         this.needsRefreshOnNav = true;
    //         return;
    //     }
    //     const savedSession = event.entity;
    //     this.dataItems.some((d, index) => {
    //         if (d.track.id === savedSession.id) {
    //             d.track = savedSession;
    //             // d.selected = true;
    //             this.dataItems.setItem(index, d);
    //             return true;
    //         }
    //     });
    // }

    mounted() {
        // this.dbHandler.connection.subscribers.push(this as any);
        super.mounted();
    }
    destroyed() {
        // const index = this.dbHandler.connection.subscribers.indexOf(this as any);
        // this.dbHandler.connection.subscribers.splice(index, 1);
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
    onTrackChecked(item: Item, $event) {
        const trackId = item.track.id;
        if ($event.value) {
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
                this.geoHandler.currentTrack = item.track;
                this.currentTrackId = trackId;
            }
        } else {
            if (this.currentTrackId === trackId) {
                this.setChecked(item, false);
                this.geoHandler.currentTrack = null;
                this.currentTrackId = null;
            }
        }
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

    // deleteSelectedSessions() {
    //     return confirm({
    //         title: this.$tc('delete'),
    //         message: this.$tc('confirm_delete_sessions', this.selectedSessions.length),
    //         okButtonText: this.$tc('delete'),
    //         cancelButtonText: this.$tc('cancel')
    //     })
    //         .then((result) => {
    //             if (result) {
    //                 const indexes = [];
    //                 this.dataItems.forEach((d, index) => {
    //                     if (d.selected) {
    //                         indexes.push(index);
    //                     }
    //                 });
    //                 return this.dbHandler.trackRepository.delete(this.selectedSessions).then(() => {
    //                     indexes.reverse().forEach((index) => {
    //                         this.dataItems.splice(index, 1);
    //                     });
    //                 });
    //                 // this.unselectAllSessions();
    //                 // this.refresh();
    //                 // });
    //             }
    //         })
    //         .catch(this.showError);
    // }
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
    }

    ignoreTap = false;
    onItemLongPress(item: Item, event?) {
        if (event && event.ios && event.ios.state !== 1) {
            return;
        }
        if (event && event.ios) {
            this.ignoreTap = true;
        }
        // console.log('onItemLongPress', item, Object.keys(event));
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
        // console.log('onItemTap', event && event.ios && event.ios.state, this.selectedSessions.length);
        if (this.selectedSessions.length > 0) {
            this.onItemLongPress(item);
        } else {
            this.$navigateTo(TrackDetails, { props: { track: item.track } });
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
                        return this.geoHandler.importJSONFile(f);
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
