import { convertDuration, convertTime } from './locale';
export { convertDuration, convertTime } from './locale';
import duration from 'dayjs/plugin/duration';

export enum UNITS {
    Duration = 'duration',
    Date = 'date',
    Distance = 'm',
    DistanceKm = 'km',
    Speed = 'km/h',
    Pace = 'min/km',
    Cardio = 'bpm',
    Power = 'w',
    Battery = 'battery',
    Pressure = 'pa'
}

export function toImperialUnit(unit: UNITS, imperial = false) {
    if (imperial === false) {
        return unit;
    }
    switch (unit) {
        case UNITS.Distance:
            return 'ft';
        case UNITS.DistanceKm:
            return 'm';
        case UNITS.Speed:
            return 'mph';
        case UNITS.Pace:
            return 'min/m';
        default:
            return unit;
    }
}

export function convertValueToUnit(value: any, unit: UNITS, imperial: boolean, options: { roundedTo05?: boolean } = {}): [string, string] {
    if (value === undefined || value === null) {
        return ['', ''];
    }

    if (value === -1) {
        return ['-', toImperialUnit(unit, imperial)];
    }
    switch (unit) {
        case UNITS.Duration:
            return [convertDuration(value, 'HH:mm:ss'), ''];

        case UNITS.Date:
            return [convertTime(value, 'M/d/yy h:mm a'), ''];

        case UNITS.Distance:
            if (imperial) {
                value *= 3.28084; // to feet
            }
            return [value.toFixed(), toImperialUnit(unit, imperial)];
        case UNITS.DistanceKm:
            if (imperial) {
                value *= 3.28084; // to feet
                if (value < 5280) {
                    return [value.toFixed(), toImperialUnit(UNITS.Distance, imperial)];
                } else if (value > 528000) {
                    return [(value / 5280).toFixed(0), toImperialUnit(unit, imperial)];
                } else {
                    return [(value / 5280).toFixed(1), toImperialUnit(unit, imperial)];
                }
            } else {
                if (value < 1000) {
                    return [value.toFixed(), UNITS.Distance];
                } else if (value > 100000) {
                    return [(value / 1000).toFixed(0), toImperialUnit(unit, imperial)];
                } else {
                    return [(value / 1000).toFixed(1), toImperialUnit(unit, imperial)];
                }
            }

        case UNITS.Speed:
            if (imperial) {
                value *= 0.6213712; // to mph
            }
            if (options.roundedTo05 === true) {
                return [(Math.round(value * 2) / 2).toFixed(1), toImperialUnit(unit, imperial)];
            }
            return [value.toFixed(1), toImperialUnit(unit, imperial)];
        // }
        case UNITS.Pace:
            if (imperial) {
                value *= 0.6213712; // to mph
            }
            let result = value < 0.001 ? 0 : 60.0 / value;

            if (result > 60.0) {
                result = 0;
            }
            const minutes = Math.floor(result) % 60;
            const seconds = Math.floor((result - minutes) * 60);
            return [`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, toImperialUnit(unit, imperial)];
        default:
            return [value.toFixed(), toImperialUnit(unit, imperial)];
    }
}

export function formatValueToUnit(value: any, unit: UNITS, imperial: boolean, options: { prefix?: string; roundedTo05?: boolean } = {}) {
    let result = convertValueToUnit(value, unit, imperial, options).join('');
    if (options && options.prefix && result.length > 0) {
        result = options.prefix + result;
    }
    return result;
}

export enum DURATION_FORMAT {
    LONG,
    SHORT,
    VERY_SHORT,
    SECONDS
}

export function formatDuration(duration: duration.Duration, format: DURATION_FORMAT = DURATION_FORMAT.LONG) {
    if (duration === undefined) {
        return undefined;
    }
    const hours = duration.get('hours');
    if (isNaN(hours)) {
        return undefined;
    }
    const minutes = duration.get('minutes');
    let mintext;
    if (minutes !== 0) {
        mintext = minutes + '';
        switch (format) {
            case DURATION_FORMAT.SHORT:
                mintext += 'm';
                break;
            case DURATION_FORMAT.VERY_SHORT:
                if (hours === 0) {
                    mintext += 'm';
                }
                break;
            default:
                mintext += ' min';
                break;
        }
    }
    if (format === DURATION_FORMAT.SECONDS) {
        const seconds = duration.get('seconds');
        if (seconds !== 0) {
            mintext += ' ' + seconds + 's';
        }
    }
    if (hours === 0) {
        return mintext;
    }
    if (hours !== 0 && minutes === 0) {
        return hours + (format === DURATION_FORMAT.LONG ? ' h' : 'h');
    }
    return hours + 'h ' + mintext;
}
