import { BaseEntity, Column, Entity, PrimaryColumn } from '@nativescript-community/typeorm';
import { MapBounds, MapPos } from '@nativescript-community/ui-carto/core';
import { FeatureCollection, GeometryObject, Position } from 'geojson';

// const writer = new GeoJSONGeometryWriter();
// const reader = new GeoJSONGeometryReader();

// namespace GeometryTransformer {
//     export function to(value: FeatureCollection<LatLonKeys>): any {
//         const result = writer.writeFeatureCollection(value);
//         return result;
//     }

//     export function from(value: any): FeatureCollection<LatLonKeys> {
//         const result = reader.readFeatureCollection(value);
//         return result;
//     }
// }
export interface GeometryProperties {
    index: string;
    type?: string;
    shape?: string;
    color?: string;
    name?: string;
    radius?: number;
}
export type TrackGeometry = GeometryObject & {
    center: Position;
    extent: [number, number, number, number];
};
export interface TrackFeatureCollection extends FeatureCollection<TrackGeometry, GeometryProperties> {
    extent: [number, number, number, number];
}
export interface TrackData {
    color?: string;
}

@Entity()
export default class Track extends BaseEntity {
    constructor(id: number) {
        super();
        this.id = id + '';
    }

    @PrimaryColumn()
    id: string;
    @Column({ nullable: true })
    name?: string;
    @Column({ nullable: true })
    desc?: string;

    @Column('simple-json')
    geometry: TrackFeatureCollection;

    @Column('simple-json', { nullable: true })
    bounds?: MapBounds<LatLonKeys>;
}
