import { EventData, Observable, Utils } from '@nativescript/core';
import { Color } from '@nativescript/core/color';
import Vue from 'vue';

export function pick<T extends object, U extends keyof T>(object: T, ...props: U[]): Pick<T, U> {
    return props.reduce((o, k) => ((o[k] = object[k]), o), {} as any);
}
export function omit<T extends object, U extends keyof T>(object: T, ...props: U[]): Omit<T, U> {
    return Object.keys(object)
        .filter((key) => (props as string[]).indexOf(key) < 0)
        .reduce((newObj, key) => Object.assign(newObj, { [key]: object[key] }), {} as any);
}

const observable = new Observable();
export const on = observable.on.bind(observable);
export const off = observable.off.bind(observable);
export const notify = function <T extends Partial<EventData>>(data: T) {
    data.object = data.object || observable;
    observable.notify.call(observable, data as EventData);
};

export function permResultCheck(r) {
    if (Array.isArray(r)) {
        return r[0] === 'authorized';
    } else {
        const unauthorized = Object.keys(r).some((s) => r[s] !== 'authorized');
        return !unauthorized;
    }
}

const verRegex = /^(?:v?)(\d+)\.(\d+)\.(\d+)([a-z])?$/;
export function versionCompare(v1: string, v2: string) {
    DEV_LOG && console.log('versionCompare', v1, v2);
    const match1 = v1.match(verRegex);
    const match2 = v2.match(verRegex);
    DEV_LOG && console.log('versionCompare', v1, v2, match1.length, match2.length, match1, match2);
    if (!match1 || !match2) {
        return NaN;
    }
    const l1 = match1.length;
    const l2 = match2.length;
    //fixed to 5 as we now
    for (let i = 1; i < l1; ++i) {
        if (l2 === i) {
            return 1;
        }
        let num1 = parseInt(match1[i], 10);
        if (isNaN(num1)) {
            // if (match1[i] === 'b' && i === l1 - 1) {
            //     num1 = -1;
            // } else {
            num1 = match1[i] ? match1[i].charCodeAt(0) : 0;
            // }
        }
        let num2 = parseInt(match2[i], 10);
        if (isNaN(num2)) {
            // if (match2[i] === 'b' && i === l2 - 1) {
            //     num2 = -1;
            // } else {
            num2 = match2[i] ? match2[i].charCodeAt(0) : 0;
            // }
        }
        if (num1 === num2) {
            continue;
        } else if (num1 > num2) {
            return 1;
        } else {
            return -1;
        }
    }

    if (l1 !== l2) {
        return -1;
    }

    return 0;
}

export function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashCode(s) {
    return s.split('').reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
    }, 0);
}

type HandlerFunction = (error: Error, ctx: any) => void;

export const Catch =
    (handler: HandlerFunction = (err, ctx) => Vue.prototype.$showError(err), errorType: any = Error): any =>
    (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        // Save a reference to the original method
        const originalMethod = descriptor.value;

        // Rewrite original method with try/catch wrapper
        descriptor.value = function (...args: any[]) {
            try {
                const result = originalMethod.apply(this, args);

                // Check if method is asynchronous
                if (result && result instanceof Promise) {
                    // Return promise
                    return result.catch((error: any) => {
                        _handleError(this, error, handler, errorType);
                    });
                }

                // Return actual result
                return result;
            } catch (error) {
                _handleError(this, error, handler, errorType);
            }
        };

        return descriptor;
    };

export const CatchAll = (handler: HandlerFunction): any => Catch(handler, Error);

function _handleError(ctx: any, error: Error, handler: HandlerFunction, errorType: any) {
    // Check if error is instance of given error type
    if (typeof handler === 'function' && error instanceof errorType) {
        // Run handler with error object and class context
        handler.call(ctx, error);
    }
    // } else {
    // Throw error further
    // Next decorator in chain can catch it
    throw error;
    // }
}

export function setVolumeLevel(audioVol: number) {
    if (__ANDROID__) {
        const AudioManager = android.media.AudioManager;
        const ctx = Utils.ad.getApplicationContext();
        const audioManager = ctx.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
        const musicVolumeMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        const volumeIndex = Math.round((audioVol * musicVolumeMax) / 100);
        // console.log('setVolumeLevel', musicVolumeMax, audioVol, volumeIndex);
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volumeIndex, 0);
    }
    if (__IOS__) {
        //@ts-ignore
        const volumeView = MPVolumeView.alloc().init();
        for (let i = 0; i < volumeView.subviews.count; i++) {
            //@ts-ignore
            if (volumeView.subviews[i] instanceof UISlider) {
                //@ts-ignore
                const volSlider = volumeView.subviews[i] as unknown as UISlider;
                setTimeout(() => (volSlider.value = audioVol), 500);
                break;
            }
        }
    }
}
export function getVolumeLevel() {
    if (__ANDROID__) {
        const AudioManager = android.media.AudioManager;
        const ctx = Utils.ad.getApplicationContext();
        const audioManager = ctx.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
        const musicVolumeMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        const musicVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        // console.log('getVolumeLevel', musicVolumeMax, musicVolume);
        return (musicVolume / musicVolumeMax) * 100;
    }
    if (__IOS__) {
        //@ts-ignore
        const volumeView = MPVolumeView.alloc().init();
        for (let i = 0; i < volumeView.subviews.count; i++) {
            //@ts-ignore
            if (volumeView.subviews[i] instanceof UISlider) {
                //@ts-ignore
                const volSlider = volumeView.subviews[i] as unknown as UISlider;
                return volSlider.value;
            }
        }
    }
}

export function createColorMatrix(colorStr: string) {
    const color = new Color(colorStr);
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    return [r, r, r, 0, 0, g, g, g, 0, 0, b, b, b, 0, 0, 0, 0, 0, 1, 0];
}
