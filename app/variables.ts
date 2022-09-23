import { Screen } from '@nativescript/core/platform';
const locals = require('./variables.module.scss').default.locals;

export const primaryColor: string = locals.primaryColor;
export const accentColor: string = locals.accentColor;
export const darkColor: string = locals.darkColor;
export const textColor: string = locals.textColor;
export const subtitleColor: string = locals.subtitleColor;
export const borderColor: string = locals.borderColor;
export const backgroundColor: string = locals.backgroundColor;
export const mdiFontFamily: string = locals.mdiFontFamily;
export const actionBarHeight: number = parseFloat(locals.actionBarHeight);
export const actionBarButtonHeight: number = parseFloat(locals.actionBarButtonHeight);
export const screenHeightDips = Screen.mainScreen.heightDIPs;
export const screenWidthDips = Screen.mainScreen.widthDIPs;
