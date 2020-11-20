import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { LineChart } from '@nativescript-community/ui-chart/charts/LineChart';
import { XAxisPosition } from '@nativescript-community/ui-chart/components/XAxis';
import { LineData } from '@nativescript-community/ui-chart/data/LineData';
import { LineDataSet } from '@nativescript-community/ui-chart/data/LineDataSet';
import { layout } from '@nativescript/core/utils/utils';
import { Component, Prop } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GeoHandler, GeoLocation, Session } from '~/handlers/GeoHandler';
import { UNITS, convertDuration, convertValueToUnit, toImperialUnit } from '~/helpers/formatter';
import { computeDistance, getBoundsZoomLevel, getCenter } from '~/helpers/geo';
import Track from '~/models/Track';
// import {notify as appNotify, HistorySessionUpdatedEvent} from './App';
import MapComponent from './MapComponent';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

@Component({
    components: {
        MapComponent
    }
})
export default class TrackDetails extends BgServiceComponent {
    @Prop()
    track: Track;
    navigateUrl = 'sessionDetails';
    public simplified = false;
    map: CartoMap<LatLonKeys>;

    editableName: string = null;
    editableDesc: string = null;

    @Prop({ type: Boolean, default: false }) startInEdit: boolean;
    @Prop({ type: Boolean, default: true }) editable: boolean;

    isEditing = false;
    loaded = false;

    mounted() {
        super.mounted();
        this.isEditing = this.editable && this.startInEdit;
        this.editableName = this.track.name || '';
        this.editableDesc = this.track.desc || '';
        this.loaded = true;
    }

    onImperialUnitChanged(value: boolean) {
        this.$refs.charts.forEach((view) => {
            const chart = view.nativeView as LineChart;
            chart.invalidate();
        });
    }
    chartUnit(key: string) {
        let unit: UNITS;
        switch (key) {
            case 'distance':
                unit = UNITS.Distance;
                break;
            case 'speed':
                unit = UNITS.Speed;
                break;
            case 'altitude':
                unit = UNITS.Distance;
                break;
            case 'hr':
                unit = UNITS.Cardio;
                break;
        }
        return unit;
    }
    get chartTitle() {
        return (key: string) => `${this.$tu(key)} (${toImperialUnit(this.chartUnit(key), this.imperialUnit).toUpperCase()})`;
    }
    onLoaded() {}
    onNavigatedTo() {}

    destroyed() {
        super.destroyed();
    }

    get chartKeys() {
        const result = ['speed', 'altitude', 'distance'];
        return result;
    }

    get currentSession() {
        return this.track;
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

    save() {
        if (this.isEditing) {
            this.showLoading(this.$t('saving'));
            this.track.name = this.editableName;
            this.track.desc = this.editableDesc;
            this.track
                .save()
                .then(() => {
                    // appNotify({eventName:HistorySessionUpdatedEvent, session:this.session});
                    this.hideLoading();
                    this.leaveEditing();
                })
                .catch(this.showError);
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
    onServiceLoaded(geoHandler: GeoHandler) {}
}
