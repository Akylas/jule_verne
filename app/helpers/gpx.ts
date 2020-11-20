import * as xml2js from 'xml2js';
// import GPX from 'gpx-parser-builder';
import Track from '~/models/Track';
import { convertTime } from './formatter';
import { GeoLocation } from '~/handlers/GeoHandler';
import * as EInfo from '@nativescript-community/extendedinfo';

interface Waypoint {
    $?: {
        lat: number;
        lon: number;
    };
    lat?: number;
    lon?: number;
    time: Date | number;
    geoidheight?: number;
    hdop?: number;
    ele?: number;
    vdop?: number;
    pdop?: number;
    magvar?: number;
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    ageofdgpsdata?: any;
    dgpsid?: any;
    extensions?: any;
    sat?: any;
    type?: any;
    sym?: any;
}
interface Route {
    name?: string;
    type?: any;
    cmt?: string;
    desc?: string;
    src?: string;
    extensions?: any;
    number?: number;
    rtept?: Waypoint[] | Waypoint;
}
interface TrackSegment {
    trkpt?: Waypoint[] | Waypoint;
}
interface Bounds {
    minlat?: number;
    minlon?: number;
    maxlat?: number;
    maxlon?: number;
}
interface Copyright {
    author?: string;
    year?: number;
    license?: string;
}
interface Person {
    name?: string;
    link?: Link;
    email?: string;
}
interface Link {
    $?: {
        href?: string;
    };
    href?: string;
    text?: string;
    type?: string;
}
interface Metadata {
    copyright?: Copyright;
    link?: Link;
    author?: Person;
    name?: string;
    desc?: string;
    time: Date;
    keywords?: string;
    extensions?: string;
    bounds?: Bounds;
}
interface GPXTrack {
    name?: string;
    type?: any;
    cmt?: string;
    desc?: string;
    src?: string;
    extensions?: any;
    number?: number;
    trkseg?: TrackSegment[] | TrackSegment;
}
export declare class GPXType {
    constructor(object: {
        $?: {
            [k: string]: any;
        };
        metadata?: Partial<Metadata>;
        wpt?: Waypoint[];
        trk?: GPXTrack[] | GPXTrack;
        rte?: Route[] | Route;
    });
    $: {
        [k: string]: any;
    };
    metadata: Metadata;
    wpt: Waypoint[];
    trk?: GPXTrack[] | GPXTrack;
    rte?: Route[] | Route;
    toString(options?): string;
    static parse(str: string): GPXType;
}

export function parseGPX(gpxString: string): Promise<GPXType> {
    return new Promise((resolve, reject) => {
        xml2js.parseString(
            gpxString,
            {
                explicitArray: false
            },
            (err, xml) => {
                if (err) {
                    return reject(err);
                }
                if (!xml.gpx) {
                    return reject(new Error('wrong_gpx'));
                }
                try {
                    const gpx = xml.gpx;
                    resolve(gpx);
                } catch (e) {
                    console.log(e);
                    reject(e);
                }
            }
        );
    });
}

// export function toGPX(session: Track, positions: GeoLocation[]) {
//     const name = session.name || `session_${session.startTime.getTime()}`.replace(/[\s\/,:]+/g, '_');
//     const desc = session.desc || `${convertTime(session.startTime, 'LLL')}`;
//     const bounds = session.bounds;
//     const builder = new xml2js.Builder({
//         rootName: 'gpx'
//     });
//     return {
//         name,
//         // eslint-disable-next-line id-blacklist
//         string: builder.buildObject({
//             $: {
//                 version: '1.1',
//                 xmlns: 'http://www.topografix.com/GPX/1/1',
//                 'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
//                 'xsi:schemaLocation': 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd',
//                 creator: `${EInfo.getVersionNameSync()}.${EInfo.getBuildNumberSync()}`
//             },
//             metadata: {
//                 name,
//                 desc,
//                 time: session.startTime,
//                 bounds: {
//                     minlat: bounds.southwest.lat,
//                     minlon: bounds.southwest.lon,
//                     maxlat: bounds.northeast.lat,
//                     maxlon: bounds.northeast.lon
//                 },
//                 copyright: {
//                     author: 'gpstest',
//                     year: 2019
//                 },
//                 keywords: ['gpstest', 'course'].join(', '),
//                 link: {
//                     $: {
//                         href: 'https://gpstest.net'
//                     },
//                     text: 'gpstest',
//                     type: 'text/html'
//                 }
//             },
//             trk: {
//                 trkseg: {
//                     trkpt: positions.map(l => {
//                         const result = {
//                             $: {
//                                 lat: Math.round(l.lat * 1000000) / 1000000,
//                                 lon: Math.round(l.lon * 1000000) / 1000000
//                             },
//                             // fix: '3d',
//                             time: new Date(l.timestamp).toISOString().split('.')[0] + 'Z',
//                             speed: Math.round(l.computedSpeed || l.speed * 100) / 100,
//                             ele: Math.round(l.altitude * 100) / 100
//                         } as any;
//                         if (l.bearing !== undefined) {
//                             result.course = l.bearing;
//                         }
//                         if (l.provider !== undefined) {
//                             result.src = l.provider;
//                         }
//                         return result;
//                     })
//                 }
//             }
//         })
//     };
// }
