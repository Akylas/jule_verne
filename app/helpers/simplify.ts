import { GeoLocation } from '~/handlers/GeoHandler';

type FilterGeoLocation = Pick<GeoLocation, 'lat' | 'lon'>;
/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

// to suit your point format, run search/replace for '[0]' and '[1]';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
export function getSqDist(p1: FilterGeoLocation, p2: FilterGeoLocation) {
    const dx = p1.lat - p2.lat,
        dy = p1.lon - p2.lon;

    return dx * dx + dy * dy;
}

// square distance from a point to a segment
export function getSqSegDist(p: FilterGeoLocation, p1: FilterGeoLocation, p2: FilterGeoLocation) {
    let x = p1.lat,
        y = p1.lon,
        dx = p2.lat - x,
        dy = p2.lon - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p.lat - x) * dx + (p.lon - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2.lat;
            y = p2.lon;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.lat - x;
    dy = p.lon - y;

    return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
export function simplifyRadialDist<T extends FilterGeoLocation>(points: T[], sqTolerance) {
    let prevPoint = points[0],
        point: T;
    const newPoints = [prevPoint];
    for (let i = 1, len = points.length; i < len; i++) {
        point = points[i];

        if (getSqDist(point, prevPoint) > sqTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (prevPoint !== point) newPoints.push(point);

    return newPoints;
}

export function simplifyDPStep<T extends FilterGeoLocation>(points: T[], first, last, sqTolerance, simplified, transform: (point: T) => T) {
    let maxSqDist = sqTolerance,
        index;

    for (let i = first + 1; i < last; i++) {
        const sqDist = getSqSegDist(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep<T>(points, first, index, sqTolerance, simplified, transform);
        simplified.push(transform(points[index]));
        if (last - index > 1) simplifyDPStep<T>(points, index, last, sqTolerance, simplified, transform);
    }
}

// simplification using Ramer-Douglas-Peucker algorithm
export function simplifyDouglasPeucker<T extends FilterGeoLocation>(points: T[], sqTolerance, transform: (point: T) => T) {
    const last = points.length - 1;

    const simplified = [transform(points[0])];
    simplifyDPStep<T>(points, 0, last, sqTolerance, simplified, transform);
    simplified.push(transform(points[last]));

    return simplified;
}

// both algorithms combined for awesome performance
export function simplify<T extends FilterGeoLocation>(points: T[], tolerance = 1, highestQuality = false, transform: (point: T) => T = p => p) {
    if (points.length <= 2) return points;

    const sqTolerance = tolerance * tolerance;

    points = highestQuality ? points : simplifyRadialDist<T>(points, sqTolerance);
    points = simplifyDouglasPeucker<T>(points, sqTolerance, transform);

    return points;
}
