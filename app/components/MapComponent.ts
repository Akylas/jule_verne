import { request } from '@nativescript-community/perms';
import { TWEEN } from '@nativescript-community/tween';
import { MapPosVector, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { MergedMBVTTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';
import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { HillshadeRasterTileLayer, RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
import { VectorElementEventData, VectorLayer, VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { Projection } from '@nativescript-community/ui-carto/projections';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Line, LineEndType, LineJointType } from '@nativescript-community/ui-carto/vectorelements/line';
import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
import { Group } from '@nativescript-community/ui-carto/vectorelements/group';
import { Text } from '@nativescript-community/ui-carto/vectorelements/text';
import { MBVectorTileDecoder } from '@nativescript-community/ui-carto/vectortiles';
import { Application } from '@nativescript/core';
import { getNumber, getString } from '@nativescript/core/application-settings';
import { Color } from '@nativescript/core/color';
import { EventData, Observable } from '@nativescript/core/data/observable';
import { ChangeType, ChangedData, ObservableArray } from '@nativescript/core/data/observable-array';
import { Folder, knownFolders, path } from '@nativescript/core/file-system';
import { addWeakEventListener, removeWeakEventListener } from '@nativescript/core/ui';
import dayjs from 'dayjs';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { GeoHandler, GeoLocation, PositionStateEvent, UserLocationdEventData, UserRawLocationEvent } from '~/handlers/GeoHandler';
import Track, { GeometryProperties, TrackFeature, TrackGeometry } from '~/models/Track';
import { getDataFolder } from '~/utils/utils';
import { computeAngleBetween } from '~/utils/geo';
import BgServiceComponent, { BgServiceMethodParams } from './BgServiceComponent';
import { GeoJSONGeometryReader } from '@nativescript-community/ui-carto/geometry/reader';
import { BBox, Feature } from 'geojson';
import { VectorElement } from '@nativescript-community/ui-carto/vectorelements';

const LOCATION_ANIMATION_DURATION = 300;
const production = TNS_ENV === 'production';

@Component({})
export default class MapComponent extends BgServiceComponent {
    _cartoMap: CartoMap<LatLonKeys> = null;
    mapProjection: Projection = null;
    rasterLayer: RasterTileLayer = null;
    lastUserLocation: GeoLocation = null;
    _localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    userBackMarker: Point<LatLonKeys>;
    userMarker: Point<LatLonKeys>;
    accuracyMarker: Polygon<LatLonKeys>;
    aimingLine: Line<LatLonKeys>;
    @Prop({ default: true, type: Boolean }) locationEnabled: boolean;
    isUserFollow: boolean;
    @Prop({ default: null }) tracks: Track[] | ObservableArray<Track>;
    @Prop({ default: false, type: Boolean }) readonly licenseRegistered!: boolean;
    @Prop({ default: false, type: Boolean }) readonly showLocationButton!: boolean;

    realTimeShowUnfiltered = true;
    hillshadeLayer: HillshadeRasterTileLayer;
    vectorLayer: VectorTileLayer;

    get cartoMap() {
        return this._cartoMap;
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
position:               ${this.lastUserLocation.lat.toFixed(4)},${this.lastUserLocation.lon.toFixed(4)}
horizontalAccuracy:     ${this.lastUserLocation.horizontalAccuracy.toFixed()}m
provider:               ${this.lastUserLocation.provider} 
speed:                  ${this.lastUserLocation.hasOwnProperty('speed') ? this.lastUserLocation.speed.toFixed() : '-'}m/s
altitude:               ${this.lastUserLocation.hasOwnProperty('altitude') ? this.lastUserLocation.altitude.toFixed() : '-'}m
time:                   ${this.formatDate(this.lastUserLocation.timestamp)}`;
    }
    destroyed() {
        super.destroyed();
    }
    mounted() {
        super.mounted();
    }
    getDefaultMBTilesDir() {
        let localMbtilesSource = getString('local_mbtiles_directory');
        if (!localMbtilesSource) {
            let defaultPath = path.join(getDataFolder(), 'alpimaps_mbtiles');
            if (global.isAndroid) {
                const dirs = (Application.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
                const sdcardFolder = dirs[dirs.length - 1].getAbsolutePath();
                defaultPath = path.join(sdcardFolder, '../../../..', 'alpimaps_mbtiles');
            }
            localMbtilesSource = getString('local_mbtiles_directory', defaultPath);
        }
        return localMbtilesSource;
    }
    async onMapReady(e) {
        const cartoMap = (this._cartoMap = e.object as CartoMap<LatLonKeys>);

        this.mapProjection = cartoMap.projection;
        const options = cartoMap.getOptions();
        options.setWatermarkScale(0.5);
        options.setRestrictedPanning(true);
        options.setSeamlessPanning(true);
        options.setEnvelopeThreadPoolSize(2);
        options.setTileThreadPoolSize(2);
        options.setZoomGestures(true);
        options.setRotatable(true);
        cartoMap.setZoom(getNumber('mapZoom', 16), 0);

        cartoMap.setFocusPos(this.lastKnownLocation);

        const cacheFolder = Folder.fromPath(path.join(knownFolders.documents().path, 'carto_cache'));
        const dataSource = new PersistentCacheTileDataSource({
            dataSource: new HTTPTileDataSource({
                minZoom: 2,
                subdomains: 'abc',
                maxZoom: 18,
                url: 'http://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
            }),
            databasePath: cacheFolder.path
        });
        const folderPath = this.getDefaultMBTilesDir();
        // console.log('localMbtilesSource', folderPath);
        if (folderPath) {
            await this.loadLocalMbtiles(folderPath);
        }
        if (!this.vectorLayer) {
            this.rasterLayer = new RasterTileLayer({
                zoomLevelBias: 1,
                dataSource
            });
            cartoMap.addLayer(this.rasterLayer);
        }

        this.updateTrack(this.tracks);
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
        const vectorTileDecoder = new MBVectorTileDecoder({
            style: 'voyager',
            liveReload: !PRODUCTION,
            dirPath: '~/assets/styles/osmxml'
        });
        const layer = new VectorTileLayer({
            dataSource,
            decoder: vectorTileDecoder
        });
        layer.setLabelRenderOrder(VectorTileRenderOrder.LAST);
        // layer.setBuildingRenderOrder(VectorTileRenderOrder.LAYER);
        // layer.setVectorTileEventListener(this, mapComp.mapProjection);
        return layer;
    }
    async loadLocalMbtiles(directory: string) {
        await request('storage');
        if (!Folder.exists(directory)) {
            return;
        }
        try {
            const folder = Folder.fromPath(directory);
            const entities = await folder.getEntities();
            const folders = entities.filter((e) => Folder.exists(e.path));
            console.log('folders', folders);
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = await Folder.fromPath(f.path).getEntities();
                const layer = (this.vectorLayer = this.createMergeMBtiles({
                    legend: 'https://www.openstreetmap.org/key.html',
                    name: f.name,
                    sources: subentities.map((e2) => e2.path).filter((s) => s.endsWith('.mbtiles'))
                }));
                this._cartoMap.addLayer(layer);
            }
            // const etiles = entities.filter((e) => e.name.endsWith('.etiles')).slice(-1);
            // etiles.forEach((e) => {
            //     // this.log('loading etiles', e.name);
            //     const dataSource = new MBTilesTileDataSource({
            //         // minZoom: 5,
            //         // maxZoom: 12,
            //         databasePath: e.path,
            //     });
            //     const name = e.name;
            //     const contrast = getNumber(`${name}_contrast`, 0.39);
            //     const heightScale = getNumber(`${name}_heightScale`, 0.29);
            //     const illuminationDirection = getNumber(`${name}_illuminationDirection`, 207);
            //     const opacity = getNumber(`${name}_opacity`, 1);
            //     const decoder = new MapBoxElevationDataDecoder();
            //     const layer = this.hillshadeLayer = new HillshadeRasterTileLayer({
            //         decoder,
            //         tileFilterMode: RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST,
            //         visibleZoomRange: [5, 16],
            //         contrast,
            //         illuminationDirection,
            //         highlightColor: new Color(255, 141, 141, 141),
            //         heightScale,
            //         dataSource,
            //         opacity,
            //         visible: opacity !== 0,
            //     });
            //     const tileFilterMode = getString(`${name}_tileFilterMode`, 'bilinear');
            //     switch (tileFilterMode) {
            //         case 'bicubic':
            //             layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC);
            //             break;
            //         case 'bilinear':
            //             layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR);
            //             break;
            //         case 'nearest':
            //             layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST);
            //             break;
            //     }

            //     this._cartoMap.addLayer(layer);
            // });
            // return Promise.all(
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
        if (!this._localVectorDataSource && this._cartoMap) {
            this._localVectorDataSource = new LocalVectorDataSource({ projection: this.mapProjection });
        }
        return this._localVectorDataSource;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer && this._cartoMap) {
            this.localVectorLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.localVectorDataSource });
            this.localVectorLayer.setVectorElementEventListener(this);

            // always add it at 1 to respect local order
            this._cartoMap.addLayer(this.localVectorLayer);
        }
    }
    updateUserLocation(geoPos: GeoLocation) {
        if (!geoPos) {
            return;
        }
        if (
            !this._cartoMap ||
            (this.lastUserLocation && this.lastUserLocation.lat === geoPos.lat && this.lastUserLocation.lon === geoPos.lon && this.lastUserLocation.horizontalAccuracy === geoPos.horizontalAccuracy)
        ) {
            this.lastUserLocation = geoPos;
            return;
        }

        let accuracyColor = '#0e7afe';
        const accuracy = geoPos.horizontalAccuracy || 0;
        const deltaMinutes = dayjs(new Date()).diff(dayjs(geoPos.timestamp), 'minute', true);
        if (deltaMinutes > 2) {
            accuracyColor = 'gray';
        } else {
            if (accuracy > 1000) {
                accuracyColor = 'red';
            } else if (accuracy > 10) {
                accuracyColor = 'orange';
            }
        }

        const position = { lat: geoPos.lat, lon: geoPos.lon, horizontalAccuracy: geoPos.horizontalAccuracy };
        // console.log('updateUserLocation', position, this.userFollow, accuracyColor);
        if (this.userMarker) {
            const currentLocation = { lat: this.lastUserLocation.lat, lon: this.lastUserLocation.lon, horizontalAccuracy: this.lastUserLocation.horizontalAccuracy };
            const styleBuilder = this.userMarker.styleBuilder;
            styleBuilder.color = accuracyColor;
            this.userMarker.styleBuilder = styleBuilder;
            if (this.accuracyMarker) {
                this.accuracyMarker.visible = accuracy > 10;
            }
            new TWEEN.Tween(currentLocation)
                .to(position, LOCATION_ANIMATION_DURATION)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate((newPos) => {
                    if (this.userBackMarker) {
                        this.userBackMarker.position = newPos;
                        this.userMarker.position = newPos;
                    }
                    if (this.accuracyMarker) {
                        this.accuracyMarker.positions = this.getCirclePoints(newPos);
                    }
                })
                .start(0);
        } else {
            this.getOrCreateLocalVectorLayer();
            // const projection = this.mapView.projection;

            this.accuracyMarker = new Polygon<LatLonKeys>({
                positions: this.getCirclePoints(geoPos),
                styleBuilder: {
                    size: 16,
                    color: new Color(70, 14, 122, 254),
                    lineStyleBuilder: {
                        color: new Color(150, 14, 122, 254),
                        width: 1
                    }
                }
            });
            this.localVectorDataSource.add(this.accuracyMarker);

            this.userBackMarker = new Point<LatLonKeys>({
                position,
                styleBuilder: {
                    size: 17,
                    color: '#ffffff'
                }
            });
            this.localVectorDataSource.add(this.userBackMarker);
            this.userMarker = new Point<LatLonKeys>({
                position,
                styleBuilder: {
                    size: 14,
                    color: accuracyColor
                }
            });
            this.localVectorDataSource.add(this.userMarker);
            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
        }
        if (this.userFollow) {
            this._cartoMap.setZoom(Math.max(this._cartoMap.zoom, 16), position, LOCATION_ANIMATION_DURATION);
            this._cartoMap.setFocusPos(position, LOCATION_ANIMATION_DURATION);
        }

        this.lastUserLocation = geoPos;
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
            if (!this.aimingLine) {
                const centerPos = { lat: center[1], lon: center[0] };
                this.aimingLine = new Line<LatLonKeys>({
                    positions: [loc, centerPos],
                    styleBuilder: {
                        color: 'black',
                        width: 2
                    }
                });
                this.localVectorDataSource.add(this.aimingLine);
            } else if (this.aimingLine) {
                this.aimingLine.positions = [loc, { lat: center[1], lon: center[0] }];
                this.aimingLine.visible = true;
            }
        } else {
            if (this.aimingLine) {
                this.aimingLine.visible = false;
            }
        }
    }
    setup(handlers: BgServiceMethodParams) {
        if (!handlers.geoHandler) {
            return;
        }
        this.geoHandlerOn(UserRawLocationEvent, this.onLocation, this);
        this.geoHandlerOn(PositionStateEvent, this.onTrackPositionState, this);
        const loc = handlers.geoHandler.lastLocation;
        if (loc) {
            this.onLocation({ data: loc } as any);
        }
    }

    onTrackPositionState(event: EventData) {
        const events: { index: number; distance?: number; trackId: string; state: 'inside' | 'leaving' | 'entering'; feature: TrackFeature }[] = event['data'].events;
        events.forEach((e) => {
            const { feature, index, distance, state, trackId } = e;
            const object = this.mappedTracks[trackId][feature.id];
            console.log('MapComponent', 'onTrackPositionState', trackId, feature.id, !!object, state, object instanceof Group);
            if (object) {
                if (state === 'entering') {
                    if (object instanceof Group) {
                        object.elements.forEach((e) => {
                            (e as any).offLineColor = (e as any).lineColor;
                            (e as any).offColor = (e as any).color;
                            (e as any).color = 'green';
                            (e as any).lineColor = 'green';
                        });
                    } else {
                        (object as any).offColor = (object as any).lineColor;
                        (object as any).offLineColor = (object as any).lineColor;
                        (object as any).color = 'green';
                        (object as any).lineColor = 'green';
                    }
                } else if (state === 'leaving') {
                    if (object instanceof Group) {
                        object.elements.forEach((e) => {
                            (e as any).lineColor = (e as any).offLineColor;
                            (e as any).color = (e as any).offColor;
                        });
                    } else {
                        (object as any).lineColor = (object as any).offLineColor;
                        (object as any).color = (object as any).offColor;
                    }
                }
            }
        });
    }
    searchingForUserLocation = false;
    askUserLocation() {
        if (!this.locationEnabled) {
            return;
        }
        this.userFollow = true;
        return this.geoHandler
            .enableLocation()
            .then(() => {
                this.searchingForUserLocation = true;
                return this.geoHandler.getLocation();
            })
            .catch(this.showError);
    }

    showErrorInternal(err: Error | string) {
        this.searchingForUserLocation = false;
        super.showErrorInternal(err);
    }

    onVectorElementClicked(data: VectorElementEventData) {
        // const { clickType, position, elementPos, metaData, element } = data;
        // Object.keys(metaData).forEach(k => {
        //     metaData[k] = JSON.parse(metaData[k]);
        // });
        // if (metaData.index) {
        //     const index = parseInt(metaData.index, 10);
        //     if (index > 0) {
        //         const loc = this.positions[index];
        //         const prevloc = this.positions[index - 1];
        //         showSnack({
        //             message: `id:${index} dist:${computeDistance(prevloc, loc).toFixed()}m speed:${(metaData.data as any).speed.toFixed(1)}m/s ${Math.round(
        //                 (loc.timestamp - prevloc.timestamp) / 1000
        //             )}s`
        //         });
        //     }
        // }
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
    mappedTracks: {
        [k: string]: { [k: string]: VectorElement<any, any> };
    } = {};

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
        console.log('addTrack', track.id);
        const featureCollection = track.geometry;
        const count = featureCollection.features.length;
        const objects = (this.mappedTracks[track.id] = {});
        const reader = new GeoJSONGeometryReader({});

        // const bboxpolygon = new Polygon<LatLonKeys>({
        //     positions: this.bboxToPolygon(featureCollection.bbox),
        //     styleBuilder: {
        //         color: 'transparent',
        //         lineStyleBuilder: {
        //             color: 'white',
        //             width: 2
        //         }
        //     }
        // });
        // this.localVectorDataSource.add(bboxpolygon);
        for (let index = 0; index < count; index++) {
            const feature = featureCollection.features[index];
            // console.log('test', JSON.stringify(feature.geometry));
            const geometry = reader.readGeometry(JSON.stringify(feature.geometry));
            const properties = feature.properties;

            const bboxpolygon = new Polygon<LatLonKeys>({
                positions: this.bboxToPolygon(feature.bbox),
                styleBuilder: {
                    color: 'transparent',
                    lineStyleBuilder: {
                        color: 'white',
                        width: 2
                    }
                }
            });
            this.localVectorDataSource.add(bboxpolygon);
            const name = ('index' in properties ? properties.index : properties.name) + '';
            let color = properties.color || properties.stroke || this.accentColor;
            switch ((properties.shape || properties.type).toLowerCase()) {
                case 'line': {
                    const line = new Line<LatLonKeys>({
                        geometry: geometry as LineGeometry<LatLonKeys>,
                        styleBuilder: {
                            color,
                            joinType: LineJointType.ROUND,
                            endType: LineEndType.ROUND,
                            clickWidth: 20,
                            width: 3
                        }
                    });
                    this.localVectorDataSource.add(line);
                    objects[feature.id] = line;
                    break;
                }
                case 'circle': {
                    if (!(color instanceof Color)) {
                        color = new Color(color);
                    }
                    const circle = new Polygon<LatLonKeys>({
                        positions: this.getCirclePoints(geometry.getCenterPos(), properties.radius),
                        styleBuilder: {
                            color: new Color(color.a / 2, color.r, color.g, color.b),
                            lineStyleBuilder: {
                                color,
                                width: 1
                            }
                        }
                    });
                    this.localVectorDataSource.add(circle);
                    objects[feature.id] = circle;
                    break;
                }
                case 'marker': {
                    if (!(color instanceof Color)) {
                        color = new Color(color);
                    }
                    const marker = new Marker<LatLonKeys>({
                        geometry,
                        styleBuilder: {
                            color: new Color(color.a / 2, color.r, color.g, color.b)
                        }
                    });
                    this.localVectorDataSource.add(marker);
                    objects[feature.id] = marker;
                    break;
                }
                case 'polygon': {
                    if (name === 'outer_ring') {
                        color = this.geoHandler.isInTrackBounds ? 'black' : 'red';
                    }
                    if (!(color instanceof Color)) {
                        color = new Color(color);
                    }
                    const group = new Group();
                    group.elements = [
                        new Polygon<LatLonKeys>({
                            geometry,
                            styleBuilder: {
                                color: new Color(0, color.r, color.g, color.b),
                                lineStyleBuilder: {
                                    color,
                                    width: 2
                                }
                            }
                        }),

                        new Text({
                            position: { lat: feature.geometry.center[1], lon: feature.geometry.center[0] },
                            text: name,
                            visible: name !== 'outer_ring',
                            styleBuilder: {
                                fontSize: 15,
                                anchorPointX: 0.5,
                                anchorPointY: 0.5,
                                hideIfOverlapped: false,
                                // scaleWithDPI: true,
                                color
                            }
                        })
                    ];
                    this.localVectorDataSource.add(group);
                    objects[feature.id] = group;
                    break;
                }
            }
        }
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
        const objects = this.mappedTracks[track.id];
        if (objects) {
            Object.values(objects).forEach((o) => this.localVectorDataSource.remove(o));
            delete this.mappedTracks[track.id];
        }
    }

    @Watch('tracks')
    updateTrack(newValue, oldValue?) {
        if (!this._cartoMap) {
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
            this.localVectorDataSource.clear();
            this.tracks.forEach(this.addTrack);
        } else if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
        }
    }

    formatDate(timestamp: number) {
        return dayjs(timestamp).format('LLL');
    }
}
