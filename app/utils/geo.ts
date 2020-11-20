import { MapBounds, MapPos, MapPosVector, ScreenBounds, fromNativeMapPos } from '@nativescript-community/ui-carto/core';
import { BBox, Feature, FeatureCollection, GeoJsonObject, GeometryCollection, LineString, MultiPolygon, Point, Polygon, Position } from 'geojson';

const PI = Math.PI;
const TO_RAD = PI / 180;
const TO_DEG = 180 / PI;
const PI_X2 = PI * 2;
const PI_DIV2 = PI / 2;
const PI_DIV4 = PI / 4;
// export const EARTH_RADIUS = 6378137;
export const EARTH_RADIUS = 6371009;
export const DEFAULT_TOLERANCE = 0.1;

/**
 * Calculates the center of a collection of geo coordinates
 *
 * @param        array       Collection of coords [{lat: 51.510, lon: 7.1321} {lat: 49.1238, lon: "8° 30' W"} ...]
 * @return       object      {lat: centerLat, lon: centerLng}
 */
export function getCenter(...coords: MapPos<LatLonKeys>[]) {
    if (!coords.length) {
        return undefined;
    }

    let X = 0.0;
    let Y = 0.0;
    let Z = 0.0;
    let lat, lon, coord;

    for (let i = 0, l = coords.length; i < l; ++i) {
        coord = coords[i];
        lat = coord.lat * TO_RAD;
        lon = coord.lon * TO_RAD;

        X += Math.cos(lat) * Math.cos(lon);
        Y += Math.cos(lat) * Math.sin(lon);
        Z += Math.sin(lat);
    }

    const nb_coords = coords.length;
    X = X / nb_coords;
    Y = Y / nb_coords;
    Z = Z / nb_coords;

    lon = Math.atan2(Y, X);
    const hyp = Math.sqrt(X * X + Y * Y);
    lat = Math.atan2(Z, hyp);

    return {
        lat: lat * TO_DEG,
        lon: lon * TO_DEG
    } as MapPos<LatLonKeys>;
}

function mod(x, m) {
    return ((x % m) + m) % m;
}

export function getBoundsZoomLevel(bounds: MapBounds<LatLonKeys>, mapDim: { width: number; height: number }, worldDim = 256) {
    const zoomMax = 24;

    function latRad(lat) {
        const sin = Math.sin((lat * PI) / 180);
        const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
        return Math.max(Math.min(radX2, PI), -PI) / 2;
    }

    function zoom(mapPx, worldPx, fraction) {
        return Math.round(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    const ne = bounds.northeast;
    const sw = bounds.southwest;

    const latFraction = (latRad(ne.lat) - latRad(sw.lat)) / PI;

    const lngDiff = ne.lon - sw.lon;
    const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

    const latZoom = zoom(mapDim.height, worldDim, latFraction);
    const lngZoom = zoom(mapDim.width, worldDim, lngFraction);

    return Math.min(Math.min(latZoom, lngZoom), zoomMax);
}
export function toRadians(value) {
    return value * TO_RAD;
}
export function toDegrees(value) {
    return value / TO_RAD;
}
function wrap(n, min, max) {
    return n >= min && n < max ? n : mod(n - min, max - min) + min;
}
function mercator(lat) {
    return Math.log(Math.tan(lat * 0.5 + PI_DIV4));
}
function inverseMercator(y) {
    return 2 * Math.atan(Math.exp(y)) - PI_DIV2;
}
function hav(x) {
    const sinHalf = Math.sin(x * 0.5);
    return sinHalf * sinHalf;
}
function clamp(x, low, high) {
    return x < low ? low : x > high ? high : x;
}
function havDistance(lat1, lat2, dLng) {
    return hav(lat1 - lat2) + hav(dLng) * Math.cos(lat1) * Math.cos(lat2);
}
function arcHav(x) {
    return 2 * Math.asin(Math.sqrt(x));
}

function sinSumFromHav(x, y) {
    const a = Math.sqrt(x * (1 - x));
    const b = Math.sqrt(y * (1 - y));
    return 2 * (a + b - 2 * (a * y + b * x));
}
function sinFromHav(h) {
    return 2 * Math.sqrt(h * (1 - h));
}

function havFromSin(x) {
    const x2 = x * x;
    return (x2 / (1 + Math.sqrt(1 - x2))) * 0.5;
}
function sinDeltaBearing(lat1, lng1, lat2, lng2, lat3, lng3) {
    const sinLat1 = Math.sin(lat1);
    const cosLat2 = Math.cos(lat2);
    const cosLat3 = Math.cos(lat3);
    const lat31 = lat3 - lat1;
    const lng31 = lng3 - lng1;
    const lat21 = lat2 - lat1;
    const lng21 = lng2 - lng1;
    const a = Math.sin(lng31) * cosLat3;
    const c = Math.sin(lng21) * cosLat2;
    const b = Math.sin(lat31) + 2 * sinLat1 * cosLat3 * hav(lng31);
    const d = Math.sin(lat21) + 2 * sinLat1 * cosLat2 * hav(lng21);
    const denom = (a * a + b * b) * (c * c + d * d);
    return denom <= 0 ? 1 : (a * d - b * c) / Math.sqrt(denom);
}
function isOnSegmentGC(lat1, lng1, lat2, lng2, lat3, lng3, havTolerance) {
    const havDist13 = havDistance(lat1, lat3, lng1 - lng3);
    if (havDist13 <= havTolerance) {
        return true;
    }
    const havDist23 = havDistance(lat2, lat3, lng2 - lng3);
    if (havDist23 <= havTolerance) {
        return true;
    }
    const sinBearing = sinDeltaBearing(lat1, lng1, lat2, lng2, lat3, lng3);
    const sinDist13 = sinFromHav(havDist13);
    const havCrossTrack = havFromSin(sinDist13 * sinBearing);
    if (havCrossTrack > havTolerance) {
        return false;
    }
    const havDist12 = havDistance(lat1, lat2, lng1 - lng2);
    const term = havDist12 + havCrossTrack * (1 - 2 * havDist12);
    if (havDist13 > term || havDist23 > term) {
        return false;
    }
    if (havDist12 < 0.74) {
        return true;
    }
    const cosCrossTrack = 1 - 2 * havCrossTrack;
    const havAlongTrack13 = (havDist13 - havCrossTrack) / cosCrossTrack;
    const havAlongTrack23 = (havDist23 - havCrossTrack) / cosCrossTrack;
    const sinSumAlongTrack = sinSumFromHav(havAlongTrack13, havAlongTrack23);
    return sinSumAlongTrack > 0; // Compare with half-circle == PI using sign of sin().
}

export function isLocactionInBbox(point: MapPos<LatLonKeys>, bbox: BBox, delta = 0) {
    const radius = delta > 0 ? delta / WGS84EarthRadius(point[1]) : 0;
    // Radius of the parallel at given latitude
    const pradius = delta > 0 ? (delta / EARTH_RADIUS) * Math.cos(point[1]) : 0;

    return point.lat >= bbox[1] - radius && point.lat <= bbox[3] + radius && point.lon >= bbox[0] - pradius && point.lon <= bbox[2] + pradius;
}
export function isLocationOnPath(point: MapPos<LatLonKeys>, poly: Position[], closed = false, geodesic = true, toleranceEarth: number = DEFAULT_TOLERANCE) {
    // console.log('isLocationOnPath', point, poly, closed, geodesic, toleranceEarth);
    const size = poly.length;
    if (size === 0) {
        return -1;
    }
    const tolerance = toleranceEarth / EARTH_RADIUS;
    const havTolerance = hav(tolerance);
    const lat3 = toRadians(point.lat);
    const lng3 = toRadians(point.lon);
    const prev = poly[closed ? size - 1 : 0];
    let lat1 = toRadians(prev[1]);
    let lng1 = toRadians(prev[0]);
    if (geodesic) {
        for (let index = 0; index < size; index++) {
            const point2 = poly[index];

            const lat2 = toRadians(point2[1]);
            const lng2 = toRadians(point2[0]);
            if (isOnSegmentGC(lat1, lng1, lat2, lng2, lat3, lng3, havTolerance)) {
                return index;
            }
            lat1 = lat2;
            lng1 = lng2;
        }
    } else {
        // We project the points to mercator space, where the Rhumb segment is a straight line,
        // and compute the geodesic distance between point3 and the closest point on the
        // segment. This method is an approximation, because it uses "closest" in mercator
        // space which is not "closest" on the sphere -- but the error is small because
        // "tolerance" is small.
        const minAcceptable = lat3 - tolerance;
        const maxAcceptable = lat3 + tolerance;
        let y1 = mercator(lat1);
        const y3 = mercator(lat3);
        const xTry = [];
        for (let index = 0; index < size; index++) {
            const point2 = poly[index];
            const lat2 = toRadians(point2[1]);
            const y2 = mercator(lat2);
            const lng2 = toRadians(point2[0]);
            if (Math.max(lat1, lat2) >= minAcceptable && Math.min(lat1, lat2) <= maxAcceptable) {
                // We offset longitudes by -lng1; the implicit x1 is 0.
                const x2 = wrap(lng2 - lng1, -PI, PI);
                const x3Base = wrap(lng3 - lng1, -PI, PI);
                xTry[0] = x3Base;
                // Also explore wrapping of x3Base around the world in both directions.
                xTry[1] = x3Base + 2 * PI;
                xTry[2] = x3Base - 2 * PI;
                for (let index2 = 0; index2 < xTry.length; index2++) {
                    const x3 = xTry[index2];
                    const dy = y2 - y1;
                    const len2 = x2 * x2 + dy * dy;
                    const t = len2 <= 0 ? 0 : clamp((x3 * x2 + (y3 - y1) * dy) / len2, 0, 1);
                    const xClosest = t * x2;
                    const yClosest = y1 + t * dy;
                    const latClosest = inverseMercator(yClosest);
                    const havDist = havDistance(lat3, latClosest, x3 - xClosest);
                    if (havDist < havTolerance) {
                        return index;
                    }
                }
            }
            lat1 = lat2;
            lng1 = lng2;
            y1 = y2;
        }
    }
    return -1;
}

function distanceRadians(lat1, lng1, lat2, lng2) {
    return arcHav(havDistance(lat1, lat2, lng1 - lng2));
}

/**
 * Returns the angle between two LatLngs, in radians. This is the same as the distance
 * on the unit sphere.
 */
function computeAngleBetween(from: Position, to: Position) {
    return distanceRadians(toRadians(from[1]), toRadians(from[0]), toRadians(to[1]), toRadians(to[0]));
}

/**
 * Returns the distance between two LatLngs, in meters.
 */
export function computeDistanceBetween(from: Position, to: Position) {
    return computeAngleBetween(from, to) * EARTH_RADIUS;
}
export function distanceToEnd(index: number, poly: Position[]) {
    let result = 0;
    const size = poly.length;
    let last: Position;
    for (let i = index; i < size; i++) {
        const element = poly[i];
        if (last) {
            result += computeDistanceBetween(last, element);
        }
        last = element;
    }
    return result;
}

function clipByRange(n, range) {
    return n % range;
}

function clip(n, minValue, maxValue) {
    return Math.min(Math.max(n, minValue), maxValue);
}
export function latLngToTileXY(lat, lng, zoom, tileSize = 256) {
    const MinLatitude = -85.05112878,
        MaxLatitude = 85.05112878,
        MinLongitude = -180,
        MaxLongitude = 180,
        mapSize = Math.pow(2, zoom) * tileSize;

    const latitude = clip(lat, MinLatitude, MaxLatitude);
    const longitude = clip(lng, MinLongitude, MaxLongitude);

    const p: { x?: number; y?: number } = {};
    p.x = ((longitude + 180.0) / 360.0) * (1 << zoom);
    p.y = ((1.0 - Math.log(Math.tan((latitude * Math.PI) / 180.0) + 1.0 / Math.cos(toRadians(lat))) / Math.PI) / 2.0) * (1 << zoom);

    const tilex = Math.trunc(p.x);
    const tiley = Math.trunc(p.y);
    const pixelX = Math.trunc(clipByRange((p.x - tilex) * tileSize, tileSize));
    const pixelY = Math.trunc(clipByRange((p.y - tiley) * tileSize, tileSize));

    const result = {
        x: tilex,
        y: tiley,
        pixelX,
        pixelY
    };
    return result;
}

// Semi-axes of WGS-84 geoidal reference
const WGS84_a = 6378137.0; // Major semiaxis [m]
const WGS84_b = 6356752.3; // Minor semiaxis [m]
function WGS84EarthRadius(lat) {
    // http://en.wikipedia.org/wiki/Earth_radius
    const An = WGS84_a * WGS84_a * Math.cos(lat);
    const Bn = WGS84_b * WGS84_b * Math.sin(lat);
    const Ad = WGS84_a * Math.cos(lat);
    const Bd = WGS84_b * Math.sin(lat);
    return Math.sqrt((An * An + Bn * Bn) / (Ad * Ad + Bd * Bd));
}
export function getBoundsOfDistance(point: Position, distance) {
    // Bounding box surrounding the point at given coordinates,
    // assuming local approximation of Earth surface as a sphere
    // of radius given by WGS84
    const lat = toRadians(point[1]);
    const lon = toRadians(point[0]);

    const radius = WGS84EarthRadius(lat);
    // Radius of the parallel at given latitude
    const pradius = EARTH_RADIUS * Math.cos(lat);

    const latMin = lat - distance / radius;
    const latMax = lat + distance / radius;
    const lonMin = lon - distance / pradius;
    const lonMax = lon + distance / pradius;
    return [toDegrees(lonMin), toDegrees(latMin), toDegrees(lonMax), toDegrees(latMax)] as BBox;
}
function bboxFromCoords(feature: Feature) {
    if (feature.geometry.type === 'Point' && feature.properties.radius) {
        return getBoundsOfDistance(feature.geometry.coordinates, feature.properties.radius);
    }
    const coords = getCoordinatesDump(feature);
    const bbox = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    return coords.reduce(function (prev, coord) {
        return [Math.min(coord[0], prev[0]), Math.min(coord[1], prev[1]), Math.max(coord[0], prev[2]), Math.max(coord[1], prev[3])];
    }, bbox) as BBox;
}

function bbboxesUnion(bboxes: BBox[]) {
    const res = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as BBox;
    bboxes.forEach((b) => {
        res[0] = Math.min(res[0], b[0]);
        res[1] = Math.min(res[1], b[1]);
        res[2] = Math.max(res[2], b[2]);
        res[3] = Math.max(res[3], b[3]);
    });
    // console.log('bbboxesUnion', bboxes, res);
    return res;
}

export function bboxify(collection: FeatureCollection) {
    const bboxes = [];
    collection.features.forEach((feature) => {
        if (!feature.bbox) {
            feature.bbox = bboxFromCoords(feature);
        }
        bboxes.push(feature.bbox);
    });
    if (!collection.bbox) {
        collection.bbox = bbboxesUnion(bboxes);
    }
    return collection;
}

function getCoordinatesDump(feature: Feature) {
    let coords;
    const gj = feature.geometry;
    if (gj.type === 'Point') {
        coords = [gj.coordinates];
    } else if (gj.type === 'LineString' || gj.type === 'MultiPoint') {
        coords = (gj as LineString).coordinates;
    } else if (gj.type === 'Polygon' || gj.type === 'MultiLineString') {
        coords = (gj as Polygon).coordinates.reduce(function (dump, part) {
            return dump.concat(part);
        }, []);
    } else if (gj.type === 'MultiPolygon') {
        coords = gj.coordinates.reduce(function (dump, poly) {
            return dump.concat(
                poly.reduce(function (points, part) {
                    return points.concat(part);
                }, [])
            );
        }, []);
    }
    return coords;
}
