import * as mdDialogs from '@nativescript-community/ui-material-dialogs';
import * as tnsDialogs from '@nativescript/core/ui/dialogs';
export * from '@nativescript-community/ui-material-dialogs';

export const confirm = function (options: tnsDialogs.ConfirmOptions & mdDialogs.MDCAlertControlerOptions) {
    return mdDialogs.confirm(options);
} as typeof mdDialogs.confirm;

export function prompt(options: mdDialogs.PromptOptions): Promise<tnsDialogs.PromptResult> {
    return mdDialogs.prompt(options);
}

export function alert(options: tnsDialogs.AlertOptions & mdDialogs.MDCAlertControlerOptions) {
    return mdDialogs.alert(options);
}
