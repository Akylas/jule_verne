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
// import {notify as appNotify, HistorySessionUpdatedEvent} from './App';
import MapComponent from './MapComponent';

@Component({
    components: {
        Editor,
        MapComponent
    }
})
export default class TrackDetails extends BgServiceComponent {
    borderColor = borderColor;
    mdiFontFamily = mdiFontFamily;
    textColor = textColor;
    @Prop()
    track: Track;
    navigateUrl = 'sessionDetails';
    public simplified = false;
    map: CartoMap<LatLonKeys>;
    dataItems: ObservableArray<Feature<TrackGeometry, GeometryProperties>> = null;

    editableName: string = null;
    editableDesc: string = null;

    @Prop({ type: Boolean, default: false }) startInEdit: boolean;
    @Prop({ type: Boolean, default: true }) editable: boolean;

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
