import { Label as HTMLLabel, Label } from '@nativescript-community/ui-label';
import { alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { Color } from '@nativescript/core/color';
import { Observable } from '@nativescript/core/data/observable';
import { BaseError } from 'make-error';
import { $t, $tc } from '~/helpers/locale';
import { booleanProperty } from './BackendService';
import { HttpRequestOptions } from './NetworkService';
import { Headers } from '@nativescript/core/http';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Device } from '@nativescript/core';
import * as Sentry from '@nativescript-community/sentry';
import { install } from '~/utils/logging';

function evalTemplateString(resource: string, obj: {}) {
    if (!obj) {
        return resource;
    }
    const names = Object.keys(obj);
    const vals = Object.keys(obj).map((key) => obj[key]);
    return new Function(...names, `return \`${resource}\`;`)(...vals);
}

export class CustomError extends BaseError {
    customErrorConstructorName: string;
    isCustomError = true;
    assignedLocalData: any;
    silent?: boolean;
    constructor(props?, customErrorConstructorName?: string) {
        super(props.message);
        this.message = props.message;
        delete props.message;

        this.silent = props.silent;
        delete props.silent;

        // we need to understand if we are duplicating or not
        const isError = props instanceof Error;
        if (customErrorConstructorName || isError) {
            // duplicating
            // use getOwnPropertyNames to get hidden Error props
            const keys = Object.getOwnPropertyNames(props);
            for (let index = 0; index < keys.length; index++) {
                const k = keys[index];
                if (!props[k] || typeof props[k] === 'function') continue;
                this[k] = props[k];
            }
        }
        this.assignedLocalData = props;

        if (!this.customErrorConstructorName) {
            this.customErrorConstructorName = customErrorConstructorName || (this as any).constructor.name; // OR (<any>this).constructor.name;
        }
    }

    localData() {
        const res = {};
        for (const key in this.assignedLocalData) {
            res[key] = this.assignedLocalData[key];
        }
        return res;
    }

    toJSON() {
        const error = {
            message: this.message
        };
        Object.getOwnPropertyNames(this).forEach((key) => {
            if (typeof this[key] !== 'function') {
                error[key] = this[key];
            }
        });
        return error;
    }
    toData() {
        return JSON.stringify(this.toJSON());
    }
    toString() {
        return evalTemplateString($t(this.message), Object.assign({ localize: $t }, this.assignedLocalData));
    }

    getMessage() {}
}
export class TimeoutError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: 'timeout_error'
                },
                props
            ),
            'TimeoutError'
        );
    }
}

export class NoNetworkError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: $tc('no_network')
                },
                props
            ),
            'NoNetworkError'
        );
    }
}
export class MessageError extends CustomError {
    constructor(props: { [k: string]: any; message: string }) {
        super(
            Object.assign(
                {
                    message: 'error'
                },
                props
            ),
            'MessageError'
        );
    }
}

export interface HTTPErrorProps {
    statusCode: number;
    responseHeaders?: Headers;
    title?: string;
    message: string;
    requestParams?: HttpRequestOptions;
}
export class HTTPError extends CustomError {
    statusCode: number;
    title?: string;
    message: string;
    responseHeaders?: Headers;
    requestParams: HttpRequestOptions;
    constructor(props: HTTPErrorProps | HTTPError) {
        super(
            Object.assign(
                {
                    message: 'httpError'
                },
                props
            ),
            'HTTPError'
        );
    }
}

export default class CrashReportService extends Observable {
    @booleanProperty({ default: true }) sentryEnabled: boolean;
    sentry: typeof Sentry;
    async start() {
        if (gVars.sentry && this.sentryEnabled) {
            try {
                install();
                const Sentry = await import('@nativescript-community/sentry');
                this.sentry = Sentry;
                Sentry.init({
                    dsn: SENTRY_DSN,
                    appPrefix: SENTRY_PREFIX,
                    release: `${__APP_ID__}@${__APP_VERSION__}+${__APP_BUILD_NUMBER__}`,
                    dist: `${__APP_BUILD_NUMBER__}.${__ANDROID__ ? 'android' : 'ios'}`
                });
                Sentry.setTag('locale', Device.language);
            } catch (err) {
                console.error(err, err.stack);
            }
        } else {
            this.sentry = null;
        }
    }
    async enable() {
        this.sentryEnabled = true;
        if (!this.sentry) {
            await this.start();
        }
    }
    async disable() {
        this.sentryEnabled = false;
    }

    captureException(err: Error | CustomError) {
        if (this.sentryEnabled && !!this.sentry) {
            if (err instanceof CustomError) {
                this.withScope((scope) => {
                    scope.setExtra('errorData', JSON.stringify(err.assignedLocalData));
                    this.sentry.captureException(err);
                });
            } else {
                return this.sentry.captureException(err);
            }
        }
    }
    captureMessage(message: string, level?) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.captureMessage(message, level);
        }
    }
    setExtra(key: string, value: any) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.setExtra(key, value);
        }
    }

    withScope(callback: (scope: Sentry.Scope) => void) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.withScope(callback);
        }
    }

    showError(err: Error | string, showAsSnack = false) {
        if (!err) {
            return;
        }
        const realError = typeof err === 'string' ? null : err;

        const isString = realError === null || realError === undefined;
        const message = isString ? (err as string) : realError.message || realError.toString();
        const reporterEnabled = this.sentryEnabled;
        if (showAsSnack || realError instanceof MessageError || realError instanceof NoNetworkError || realError instanceof TimeoutError) {
            showSnack({ message });
            return;
        }
        // const showSendBugReport = __FORCE_BUG_REPORT__ || (reporterEnabled && !isString && !(realError instanceof MessageError) && !(realError instanceof HTTPError) && !!realError.stack);
        const showSendBugReport = reporterEnabled && !isString && !(realError instanceof MessageError) && !(realError instanceof HTTPError) && !!realError.stack;
        const title = showSendBugReport ? $tc('error') : ' ';
        // if (realError instanceof HTTPError) {
        //     title = `${realError.title} (${realError.statusCode})`;
        // }
        const label = new Label();
        label.style.padding = '10 20 0 20';
        // label.style.fontSize = 16;
        label.style.color = new Color(255, 138, 138, 138);
        console.error('showError', err, err['stack']);
        label.html = message.trim();
        if (reporterEnabled && showSendBugReport) {
            this.captureException(realError);
        }
        return alert({
            title,
            view: label,
            okButtonText: $tc('ok')
        });
    }
}
