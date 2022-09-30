<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatedTo="onNavigatedTo" @loaded="onLoaded">
        <GridLayout rows="auto,250,*">
            <CActionBar :title="$t('details')" showMenuIcon>
                <MDButton v-show="editable" variant="text" class="icon-btn" :text="isEditing ? 'mdi-content-save' : 'mdi-pencil'" @tap="isEditing ? save() : (isEditing = !isEditing)" />

                <MDButton v-show="isEditing" variant="text" class="icon-btn" :text="'mdi-close'" @tap="leaveEditing()" />
            </CActionBar>
            <GridLayout row="1" @layoutChanged="onMapLayoutChange">
                <MapComponent ref="mapComp" height="100%" width="100%" :tracks="[track]" @mapReady="onMapReady" :locationEnabled="false" />
            </GridLayout>
            <TabView row="2" :androidSelectedTabHighlightColor="accentColor">
                <TabViewItem title="Items">
                    <GridLayout>
                        <CollectionView :items="dataItems" rowHeight="60">
                            <v-template>
                                <CanvasLabel width="100%" height="100%" paddingLeft="16" fontSize="14" borderBottomWidth="1" :borderBottomColor="borderColor" backgroundColor="transparent">
                                    <Span :text="icon(item)" color="gray" fontSize="24" verticalAlignment="center" :fontFamily="mdiFontFamily" width="24" />
                                    <Span :color="textColor" paddingLeft="50" fontSize="15" verticalAlignment="center" :text="item.properties.name" />
                                    <Circle
                                        strokeWidth="2"
                                        paintStyle="fill_and_stroke"
                                        :strokeColor="item.properties.color"
                                        :fillColor="fillColor(item)"
                                        radius="15"
                                        antiAlias
                                        horizontalAlignment="right"
                                        verticalAlignment="middle"
                                        width="80"
                                    />
                                </CanvasLabel>
                            </v-template>
                        </CollectionView>
                    </GridLayout>
                </TabViewItem>
                <TabViewItem title="Editor">
                    <GridLayout>
                        <Editor :track="track" />
                    </GridLayout>
                </TabViewItem>
            </TabView>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Color, ObservableArray } from '@nativescript/core';
import { layout } from '@nativescript/core/utils/utils';
import { Feature } from 'geojson';
import { Component, Prop } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { getBoundsZoomLevel, getCenter } from '~/helpers/geo';
import Track, { GeometryProperties, TrackGeometry } from '~/models/Track';
import { borderColor, mdiFontFamily, textColor } from '~/variables';
import Editor from './Editor.vue';
import MapComponent from './MapComponent.vue';

@Component({
    components: {
        Editor,
        MapComponent
    }
})
export default class TrackDetails extends BgServiceComponent {
    navigateUrl = 'sessionDetails';
    borderColor = borderColor;
    mdiFontFamily = mdiFontFamily;
    textColor = textColor;
    @Prop() track: Track;
    @Prop({ type: Boolean, default: false }) startInEdit: boolean;
    @Prop({ type: Boolean, default: true }) editable: boolean;
    map: CartoMap<LatLonKeys>;
    item;

    simplified = false;
    dataItems: ObservableArray<Feature<TrackGeometry, GeometryProperties>> = null;
    editableName: string = null;
    editableDesc: string = null;
    isEditing = false;
    loaded = false;

    mounted() {
        super.mounted();
        this.dataItems = new ObservableArray(this.track.geometry.features);
        this.isEditing = this.editable && this.startInEdit;
        this.editableName = this.track.name || '';
        this.editableDesc = this.track.desc || '';
        this.loaded = true;
    }

    onLoaded() {}
    onNavigatedTo() {}

    destroyed() {
        super.destroyed();
    }

    get currentSession() {
        return this.track;
    }

    get fillColor() {
        return (item: Feature<TrackGeometry, GeometryProperties>) => item.properties.fill && new Color(item.properties.fill).setAlpha(125);
    }
    get icon() {
        return (item: Feature<TrackGeometry, GeometryProperties>) => {
            switch (item.geometry.type) {
                case 'Polygon':
                    return 'mdi-vector-polygon';
                case 'LineString':
                    return 'mdi-chart-line-variant';
                case 'Point':
                    return 'mdi-map-marker';
            }
        };
    }

    mapInitialized = false;
    _cartoMap: CartoMap<LatLonKeys>;
    updateMapWithSession() {
        this.mapInitialized = true;
        const map = this._cartoMap;
        const mapBounds = this.track.bounds;
        const zoomLevel = getBoundsZoomLevel(mapBounds, { width: layout.toDeviceIndependentPixels(map.getMeasuredWidth()), height: layout.toDeviceIndependentPixels(map.getMeasuredHeight()) });
        map.setZoom(Math.min(zoomLevel - 1, 20), 0);
        map.setFocusPos(getCenter(mapBounds.northeast, mapBounds.southwest), 0);
    }
    onMapReady(e) {
        const cartoMap = (this._cartoMap = e.object as CartoMap<LatLonKeys>);
        if (!this.mapInitialized && cartoMap.getMeasuredWidth()) {
            this.updateMapWithSession();
        }
    }

    onMapLayoutChange() {
        const mapComp = this.$refs.mapComp as MapComponent;
        const map = mapComp && mapComp.cartoMap;
        if (!mapComp || !map) {
            return;
        }
        if (!this.mapInitialized) {
            this.updateMapWithSession();
        }
    }

    async save() {
        if (this.isEditing) {
            try {
                this.showLoading(this.$t('saving'));
                this.track.name = this.editableName;
                this.track.desc = this.editableDesc;
                await this.dbHandler.trackRepository.updateItem(this.track);
                // this.track
                // .save()
                // .then(() => {
                // appNotify({eventName:HistorySessionUpdatedEvent, session:this.session});
            } catch (error) {
                this.showError(error);
            } finally {
                this.hideLoading();
                this.leaveEditing();
            }
            // })
            // .catch(this.showError);
        }
    }

    leaveEditing() {
        this.isEditing = false;
        this.editableName = this.track.name;
        this.editableDesc = this.track.desc;
    }

    switchSimplify() {
        this.simplified = !this.simplified;
        // this.setMapRoute();
    }
}
</script>
