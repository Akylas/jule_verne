<template>
    <GridLayout width="100%" height="100%">
        <CartoMap ref="mapView" zoom="16" @mapReady="onMapReady" @mapMoved="onMapMove" />
        <!-- <Label
            v-if="devMode && mLastUserLocation"
            backgroundColor="rgba(0, 0, 0, 0.533)"
            borderRadius="10"
            marginTop="4"
            padding="4"
            fontSize="11"
            textWrap
            color="white"
            horizontalAlignment="center"
            verticalAlignment="top"
            :text="lastLocationDetails"
        /> -->

        <GridLayout
            v-if="locationEnabled && showLocationButton"
            class="floating-btn"
            margin="8"
            horizontalAlignment="right"
            verticalAlignment="bottom"
            @tap="askUserLocation"
            backgroundColor="white"
            :rippleColor="accentColor"
            borderRadius="32"
            elevation="2"
        >
            <Label textAlignment="center" verticalAlignment="middle" class="mdi" :class="locationButtonLabelClass" :text="'mdi-crosshairs-gps'" :color="accentColor" fontSize="30" />
        </GridLayout>
    </GridLayout>
</template>

<script lang="ts">
import { request } from '@nativescript-community/perms';
import { GenericMapPos, MapPosVector } from '@nativescript-community/ui-carto/core';
import { GeoJSONVectorTileDataSource, MergedMBVTTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { GeoJSONGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorElementEventData, VectorLayer, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';
import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
import { Line, LineEndType, LineJointType } from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
import { Text } from '@nativescript-community/ui-carto/vectorelements/text';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { Tween } from '@nativescript-community/ui-chart/animation/Tween';
import {
    Application,
    ApplicationSettings,
    ChangedData,
    Color,
    EventData,
    Folder,
    Observable,
    ObservableArray,
    addWeakEventListener,
    knownFolders,
    path,
    removeWeakEventListener
} from '@nativescript/core';
import dayjs from 'dayjs';
import { BBox } from 'geojson';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GeoLocation, PositionStateEvent, UserLocationdEventData, UserRawLocationEvent } from '~/handlers/GeoHandler';
import Track, { TrackFeature } from '~/models/Track';
import { getDataFolder, getGlassesImagesFolder, getWorkingDir } from '~/utils/utils';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';
import { setShowDebug, setShowError, setShowInfo, setShowWarn } from '@nativescript-community/ui-carto/utils';
import { AdditiveTweening } from 'additween';
import { Catch } from '~/utils';

const LOCATION_ANIMATION_DURATION = 300;
const production = TNS_ENV === 'production';

@Component({})
export default class MapComponent extends BgServiceComponent {
    mCartoMap: CartoMap<LatLonKeys> = null;
    mMapProjection: Projection = null;
    mRasterLayer: RasterTileLayer = null;
    mLastUserLocation: GeoLocation = null;
    mLocalVectorDataSource: LocalVectorDataSource;
    mLocalBackVectorDataSource: LocalVectorDataSource;
    mLocalVectorLayer: VectorLayer;
    mLocalBackVectorLayer: VectorLayer;
    mGeoJSONVectorDataSource: GeoJSONVectorTileDataSource;
    mGeoJSONLayer: VectorTileLayer;
    mUserBackMarker: Point<LatLonKeys>;
    mUserMarker: Point<LatLonKeys>;
    mAccuracyMarker: Polygon<LatLonKeys>;
    mAimingLine: Line<LatLonKeys>;
    @Prop({ default: true, type: Boolean }) locationEnabled: boolean;
    isUserFollow: boolean = true;
    @Prop({ default: null }) tracks: Track[] | ObservableArray<Track>;
    @Prop({ default: null }) viewedFeature: string[];
    @Prop({ default: false, type: Boolean }) readonly licenseRegistered!: boolean;
    @Prop({ default: false, type: Boolean }) readonly showLocationButton!: boolean;

    realTimeShowUnfiltered = true;
    vectorLayer: VectorTileLayer;

    get cartoMap() {
        return this.mCartoMap;
    }
    get userFollow() {
        return this.isUserFollow;
    }
    set userFollow(value: boolean) {
        if (value !== undefined && value !== this.isUserFollow) {
            this.isUserFollow = value;
        }
    }

    get locationButtonLabelClass() {
        return this.searchingForUserLocation ? 'fade-blink' : '';
    }

    get lastKnownLocation() {
        const lastKnown = this.geoHandler && this.geoHandler.getLastKnownLocation();
        return lastKnown || { lat: 45.2002, lon: 5.7222 };
    }

    get lastLocationDetails() {
        return `
position:               ${this.mLastUserLocation.lat.toFixed(4)},${this.mLastUserLocation.lon.toFixed(4)}
horizontalAccuracy:     ${this.mLastUserLocation.horizontalAccuracy.toFixed()}m
provider:               ${this.mLastUserLocation.provider} 
speed:                  ${this.mLastUserLocation.hasOwnProperty('speed') ? this.mLastUserLocation.speed.toFixed() : '-'}m/s
altitude:               ${this.mLastUserLocation.hasOwnProperty('altitude') ? this.mLastUserLocation.altitude.toFixed() : '-'}m
time:                   ${this.formatDate(this.mLastUserLocation.timestamp)}`;
    }
    destroyed() {
        super.destroyed();
    }
    mounted() {
        DEV_LOG && console.log('MapComponent', 'mounted');
        super.mounted();
    }
    getDefaultMBTilesDir() {
        return path.join(getWorkingDir(false), 'tiles');
    }
    async onMapReady(e) {
        DEV_LOG && console.log('MapComponent', 'onMapReady');
        const cartoMap = (this.mCartoMap = e.object as CartoMap<LatLonKeys>);

        if (!PRODUCTION) {
            setShowDebug(true);
            setShowInfo(true);
            setShowWarn(true);
            setShowError(true);
        }
        this.mMapProjection = cartoMap.projection;
        const options = cartoMap.getOptions();
        options.setWatermarkScale(0.5);
        options.setRestrictedPanning(true);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(false);
        cartoMap.setZoom(ApplicationSettings.getNumber('mapZoom', 16), 0);

        cartoMap.setFocusPos(this.lastKnownLocation);

        const cacheFolder = Folder.fromPath(path.join(knownFolders.documents().path, 'carto_cache'));
        const dataSource = new PersistentCacheTileDataSource({
            dataSource: new HTTPTileDataSource({
                minZoom: 2,
                maxZoom: 19,
                httpHeaders: {
                    'User-Agent': 'JulesVerne'
                },
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            }),
            databasePath: path.join(cacheFolder.path, 'osm.db')
        });
        const folderPath = this.getDefaultMBTilesDir();
        if (folderPath) {
            await this.loadLocalMbtiles(folderPath);
        }
        if (!this.vectorLayer) {
            this.mRasterLayer = new RasterTileLayer({
                zoomLevelBias: 1,
                dataSource
            });
            cartoMap.addLayer(this.mRasterLayer);
        }

        this.updateTrack(this.tracks);
        this.updateUserLocation(this.geoHandler.lastLocation);
        this.$emit('mapReady', e);
    }
    createMergeMBtiles({ name, sources, legend }: { name: string; sources: string[]; legend?: string }) {
        let dataSource;
        if (sources.length === 1) {
            dataSource = new MBTilesTileDataSource({
                databasePath: sources[0]
            });
        } else {
            dataSource = new MergedMBVTTileDataSource({
                dataSources: sources.map(
                    (s) =>
                        new MBTilesTileDataSource({
                            databasePath: s
                        })
                )
            });
        }
        const layer = new VectorTileLayer({
            dataSource,
            decoder: new MBVectorTileDecoder({
                style: 'streets',
                zipPath: '~/assets/styles/osm.zip'
            }),
            labelRenderOrder: VectorTileRenderOrder.LAST
        });
        return layer;
    }
    async loadLocalMbtiles(directory: string) {
        if (!Folder.exists(directory)) {
            return;
        }
        try {
            const folder = Folder.fromPath(directory);
            const entities = await folder.getEntities();
            const folders = entities.filter((e) => Folder.exists(e.path));
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = await Folder.fromPath(f.path).getEntities();
                const sources = subentities.map((e2) => e2.path).filter((s) => s.endsWith('.mbtiles'));
                if (sources.length === 0) {
                    return;
                }
                const layer = (this.vectorLayer = this.createMergeMBtiles({
                    legend: 'https://www.openstreetmap.org/key.html',
                    name: f.name,
                    sources
                }));
                this.mCartoMap.addLayer(layer);
            }
        } catch (err) {
            console.error(err);
            setTimeout(() => {
                throw err;
            }, 0);
        }
    }
    onMapMove(e) {
        if (this.locationEnabled) {
            this.userFollow = !e.data.userAction;
        }
    }
    getCirclePoints(loc: Partial<GeoLocation>, radius?: number) {
        const EARTH_RADIUS = 6378137;
        const centerLat = loc.lat;
        const centerLon = loc.lon;
        if (!radius) {
            radius = loc.horizontalAccuracy;
        }
        const N = Math.min(radius * 8, 100);

        const points = new MapPosVector<LatLonKeys>();

        for (let i = 0; i <= N; i++) {
            const angle = (Math.PI * 2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat = centerLat + (180 / Math.PI) * (dy / EARTH_RADIUS);
            const lon = centerLon + ((180 / Math.PI) * (dx / EARTH_RADIUS)) / Math.cos((centerLat * Math.PI) / 180);
            points.add({ lat, lon } as any);
        }

        return points;
    }

    get localVectorDataSource() {
        if (!this.mLocalVectorDataSource && this.mCartoMap) {
            this.mLocalVectorDataSource = new LocalVectorDataSource({ projection: this.mMapProjection });
        }
        return this.mLocalVectorDataSource;
    }
    get localBackVectorDataSource() {
        if (!this.mLocalBackVectorDataSource && this.mCartoMap) {
            this.mLocalBackVectorDataSource = new LocalVectorDataSource({ projection: this.mMapProjection });
        }
        return this.mLocalBackVectorDataSource;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.mLocalVectorLayer && this.mCartoMap) {
            this.mLocalVectorLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.localVectorDataSource });
            this.mLocalVectorLayer.setVectorElementEventListener(this);
            const projection = this.mCartoMap.projection;
            this.mLocalBackVectorDataSource = new LocalVectorDataSource({ projection });

            this.mLocalBackVectorLayer = new VectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: this.localBackVectorDataSource
            });
            this.mCartoMap.addLayer(this.mLocalBackVectorLayer);
            this.mCartoMap.addLayer(this.mLocalVectorLayer);
        }
    }
    get geoJSONVectorDataSource() {
        if (!this.mGeoJSONVectorDataSource && this.mCartoMap) {
            this.mGeoJSONVectorDataSource = new GeoJSONVectorTileDataSource({ simplifyTolerance: 0, minZoom: 0, maxZoom: 24 });
            this.mGeoJSONVectorDataSource.createLayer('items');
        }
        return this.mGeoJSONVectorDataSource;
    }
    getOrCreateGeoJSONVectorLayer() {
        if (!this.mGeoJSONLayer && this.mCartoMap) {
            this.mGeoJSONLayer = new VectorTileLayer({
                decoder: new MBVectorTileDecoder({
                    style: 'voyager',
                    liveReload: !PRODUCTION,
                    dirPath: '~/assets/styles/jule_verne'
                }),
                dataSource: this.geoJSONVectorDataSource
            });
            this.mCartoMap.addLayer(this.mGeoJSONLayer);
            this.onViewedFeature();
        }
        return this.mGeoJSONLayer;
    }
    moveToUserLocation() {
        if (!this.userFollow || !this.mLastUserLocation) {
            return;
        }
        this.mCartoMap.setZoom(Math.max(this.mCartoMap.zoom, 14), LOCATION_ANIMATION_DURATION);
        this.mCartoMap.setFocusPos(this.mLastUserLocation, LOCATION_ANIMATION_DURATION);
    }
    updateUserLocation(geoPos: GeoLocation) {
        if (!geoPos || !this.mCartoMap) {
            return;
        }
        const position = {
            ...geoPos
        };
        if (
            this.mLastUserLocation &&
            this.mLastUserLocation.lat === position.lat &&
            this.mLastUserLocation.lon === position.lon &&
            this.mLastUserLocation.horizontalAccuracy === position.horizontalAccuracy
        ) {
            this.mLastUserLocation = position;
            this.moveToUserLocation();
            return;
        }

        let accuracyColor = '#0e7afe';
        const accuracy = geoPos.horizontalAccuracy || 0;
        const deltaMinutes = dayjs(new Date()).diff(dayjs(geoPos.timestamp), 'minute', true);
        if (deltaMinutes > 2) {
            accuracyColor = 'gray';
        } else if (accuracy > 1000) {
            accuracyColor = 'red';
        } else if (accuracy > 20) {
            accuracyColor = 'orange';
        }
        if (!this.mUserMarker) {
            const posWithoutAltitude = { lat: position.lat, lon: position.lon };
            this.getOrCreateLocalVectorLayer();

            this.mAccuracyMarker = new Polygon<LatLonKeys>({
                positions: this.getCirclePoints(position),
                styleBuilder: {
                    size: 16,
                    color: new Color(70, 14, 122, 254),
                    lineStyleBuilder: {
                        color: new Color(150, 14, 122, 254),
                        width: 1
                    }
                }
            });

            this.mUserBackMarker = new Point<LatLonKeys>({
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 17,
                    color: '#ffffff'
                }
            });
            this.mUserMarker = new Point<LatLonKeys>({
                metaData: {
                    userMarker: 'true'
                },
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 14,
                    color: accuracyColor
                }
            });
            this.localBackVectorDataSource.add(this.mAccuracyMarker);
            this.localVectorDataSource.add(this.mUserBackMarker);
            this.localVectorDataSource.add(this.mUserMarker);
        } else {
            this.mUserMarker.color = accuracyColor;
            this.mAccuracyMarker.visible = accuracy > 20;

            this.mUserBackMarker.position = position;
            this.mUserMarker.position = position;
            this.mAccuracyMarker.positions = this.getCirclePoints(position);
        }
        this.mLastUserLocation = position;
        this.moveToUserLocation();
    }
    onLocation(data: UserLocationdEventData) {
        this.searchingForUserLocation = false;
        if (!this.locationEnabled) {
            return;
        }
        if (data.error) {
            return;
        }
        const loc = data.location;
        this.updateUserLocation(loc);
        const feature = data.aimingFeature;
        if (feature) {
            const center = feature.geometry.center;
            if (!this.mAimingLine) {
                const centerPos = { lat: center[1], lon: center[0] };
                this.mAimingLine = new Line<LatLonKeys>({
                    positions: [loc, centerPos],
                    styleBuilder: {
                        color: 'black',
                        width: 2
                    }
                });
                this.localVectorDataSource?.add(this.mAimingLine);
            } else if (this.mAimingLine) {
                this.mAimingLine.positions = [loc, { lat: center[1], lon: center[0] }];
                this.mAimingLine.visible = true;
            }
        } else {
            if (this.mAimingLine) {
                this.mAimingLine.visible = false;
            }
        }
    }
    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(UserRawLocationEvent, this.onLocation, this);
        // this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        const loc = handlers.geoHandler.lastLocation;
        if (loc) {
            this.onLocation({ data: loc } as any);
        }
    }

    // onTrackPositionState(event: EventData) {
    //     const events: { index: number; distance?: number; trackId: string; state: 'inside' | 'leaving' | 'entering'; feature: TrackFeature }[] = event['data'].events;
    //     events.forEach((e) => {
    //         const { feature, index, distance, state, trackId } = e;
    //         if (state === 'entering') {
    //             (this.getOrCreateGeoJSONVectorLayer().options.decoder as MBVectorTileDecoder).setStyleParameter('selected_id', feature.properties.name + '');
    //         } else if (state === 'leaving') {
    //             (this.getOrCreateGeoJSONVectorLayer().options.decoder as MBVectorTileDecoder).setStyleParameter('selected_id', '');
    //         }
    //     });
    // }
    searchingForUserLocation = false;

    @Catch()
    async askUserLocation() {
        if (!this.locationEnabled) {
            return;
        }
        DEV_LOG && console.log('askUserLocation');
        this.userFollow = true;
        this.moveToUserLocation();
        await this.geoHandler.enableLocation();
        this.searchingForUserLocation = true;
        await this.geoHandler.getLocation();
    }

    onVectorElementClicked(data: VectorElementEventData) {
        return false;
    }

    onTracksChanged(event: ChangedData<Track>) {
        if (event.removed) {
            event.removed.forEach(this.removeTrack);
        }
        if (event.addedCount > 0) {
            for (let index = event.index; index < event.index + event.addedCount; index++) {
                const element = (this.tracks as ObservableArray<Track>).getItem(index);
                this.addTrack(element);
            }
        }
    }

    bboxToPolygon(bbox: BBox) {
        return [
            {
                lat: bbox[1],
                lon: bbox[0]
            },
            {
                lat: bbox[1],
                lon: bbox[2]
            },
            {
                lat: bbox[3],
                lon: bbox[2]
            },
            {
                lat: bbox[3],
                lon: bbox[0]
            }
        ];
    }
    addTrack(track: Track) {
        if (!track) {
            return;
        }
        const featureCollection = track.geometry;

        // featureCollection.features.forEach((f) => {
        //     f.properties['image'] = path.join(getGlassesImagesFolder(), 'stories', '1', 'map.jpg');
        // });
        // console.log('track', JSON.stringify(featureCollection));
        this.getOrCreateGeoJSONVectorLayer();
        this.geoJSONVectorDataSource.setLayerGeoJSONString(1, JSON.stringify(featureCollection));
        return;

        // const line = new Line<LatLonKeys>({
        //     positions: track.positions,
        //     styleBuilder: {
        //         color: track.data.color ||  this.accentColor,
        //         joinType: LineJointType.ROUND,
        //         endType: LineEndType.ROUND,
        //         clickWidth: 20,
        //         width:  3
        //     }
        // });
        // this.mappedTracks[track.id] = line;
        // this.localVectorDataSource.add(line);
    }
    removeTrack(track: Track) {
        if (!track) {
            return;
        }
        // console.log('removeTrack', track.id, this.mappedTracks[track.id]);
        // const objects = this.mappedTracks[track.id];
        // if (objects) {
        //     Object.values(objects).forEach((o) => this.localVectorDataSource.remove(o));
        //     delete this.mappedTracks[track.id];
        // }
    }
    @Watch('viewedFeature')
    onViewedFeature() {
        const decoder = this.mGeoJSONLayer?.options?.decoder as MBVectorTileDecoder;
        if (!decoder) {
            return;
        }
        const param = this.viewedFeature ? '^(' + this.viewedFeature.map((s) => '' + s).join('|') + ')$' : '';
        // console.log('onViewedFeature', param);
        decoder.setStyleParameter('viewed', param);
    }
    @Watch('tracks')
    updateTrack(newValue, oldValue?) {
        if (!this.mCartoMap) {
            return;
        }
        if (oldValue instanceof Observable) {
            removeWeakEventListener(oldValue, ObservableArray.changeEvent, this.onTracksChanged, this);
        }

        if (newValue instanceof Observable) {
            addWeakEventListener(newValue, ObservableArray.changeEvent, this.onTracksChanged, this);
        }

        if (this.tracks) {
            this.getOrCreateLocalVectorLayer();
            // this.geoJSONVectorDataSource.clear();
            this.tracks.forEach(this.addTrack);
        } else if (this.localVectorDataSource) {
            // this.geoJSONVectorDataSource.clear();
        }
    }

    formatDate(timestamp: number) {
        return dayjs(timestamp).format('LLL');
    }
}
</script>
