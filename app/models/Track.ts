import { MapBounds } from '@nativescript-community/ui-carto/core';
import { Feature, FeatureCollection, GeometryObject, Position } from 'geojson';

import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import CrudRepository from 'kiss-orm/dist/Repositories/CrudRepository';
import NSQLDatabase from '~/handlers/NSQLDatabase';

const sql = SqlQuery.createFromTemplateString;

export interface GeometryProperties {
    index: string;
    type?: string;
    shape?: string;
    color?: string;
    stroke?: string;
    fill?: string;
    name?: string;
    radius?: number;
    isStory?: boolean;
}
export type TrackGeometry = GeometryObject & {
    center: Position;
    extent: [number, number, number, number];
};
export interface TrackFeatureCollection extends FeatureCollection<TrackGeometry, GeometryProperties> {
    extent: [number, number, number, number];
}

export type TrackFeature = Feature<TrackGeometry, GeometryProperties>;
export interface TrackData {
    color?: string;
}
export default class Track {
    public readonly id!: string;

    public name!: string;
    public desc!: string;
    public _geometry!: string;
    public geometry!: TrackFeatureCollection;
    public _bounds!: string;
    public bounds!: MapBounds<LatLonKeys>;
}
export type ITrack = Partial<Track> & {
    // vectorElement?: VectorElement<any, any>;
};

export class TrackRepository extends CrudRepository<Track> {
    constructor(database: NSQLDatabase) {
        super({
            database,
            table: 'Tracks',
            primaryKey: 'id',
            model: Track
        });
    }

    async createTables() {
        return this.database.query(sql`
			CREATE TABLE IF NOT EXISTS "Tracks" (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT,
				desc TEXT,
                bounds TEXT NOT NULL,
                geometry TEXT NOT NULL
			);
		`);
    }

    async createItem(item: ITrack) {
        await this.create({
            id: item.id,
            name: item.name,
            desc: item.desc,
            bounds: item._bounds || JSON.stringify(item.bounds),
            geometry: item._geometry || JSON.stringify(item.geometry)
        });
        return item as Track;
    }
    async updateItem(item: Track) {
        const { id, ...others } = item;
        const newItem = await this.update({ id } as any, { bounds: JSON.stringify(item.bounds), geometry: JSON.stringify(item.geometry) });
        return this.prepareGetItem(newItem);
    }

    prepareGetItem(item: Track) {
        console.log('prepareGetItem', item);
        return {
            id: item.id,
            name: item.name,
            _bounds: item.bounds,
            _geometry: item.geometry,
            get bounds() {
                if (!this._parsedBounds) {
                    console.log('test', this._bounds);
                    this._parsedBounds = JSON.parse(this._bounds);
                }
                return this._parsedBounds;
            },
            set bounds(value) {
                delete this._bounds;
                this._parsedBounds = value;
            },
            get geometry() {
                if (!this._parsedGeometry) {
                    this._parsedGeometry = JSON.parse(this._geometry);
                }
                return this._parsedGeometry;
            },
            set geometry(value) {
                delete this._geometry;
                this._parsedGeometry = value;
            }
        } as any as Track;
    }
    async getItem(itemId: string) {
        const element = await this.get(itemId);
        return this.prepareGetItem(element);
    }
    async searchItem(where?: SqlQuery | null, orderBy?: SqlQuery | null) {
        const result = (await this.search(where, orderBy)).slice();
        for (let index = 0; index < result.length; index++) {
            const element = this.prepareGetItem(result[index]);
            result[index] = element as any;
        }
        return result;
    }
}
