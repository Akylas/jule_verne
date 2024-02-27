import { AndroidActivityResultEventData, AndroidApplication, Application, Device, Folder, knownFolders, path } from '@nativescript/core';
import * as app from '@nativescript/core/application';
import { simplify_path } from './utils.common';
export * from './utils.common';

export const sdkVersion = parseInt(Device.sdkVersion, 10);
export const ANDROID_30 = __ANDROID__ && sdkVersion >= 30;

export function checkManagePermission() {
    return !ANDROID_30 || android.os.Environment.isExternalStorageManager();
}
export async function askForManagePermission() {
    const activity = Application.android.startActivity as androidx.appcompat.app.AppCompatActivity;
    if (checkManagePermission()) {
        return true;
    }
    //If the draw over permission is not available open the settings screen
    //to grant the permission.
    return new Promise<boolean>((resolve, reject) => {
        const REQUEST_CODE = 6646;
        const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
            if (data.requestCode === REQUEST_CODE) {
                Application.android.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                resolve(android.provider.Settings.canDrawOverlays(activity));
            }
        };
        Application.android.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
        const intent = new android.content.Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, android.net.Uri.parse('package:' + __APP_ID__));
        activity.startActivityForResult(intent, REQUEST_CODE);
    });
}

export function getWorkingDir(allowDev = true) {
    DEV_LOG && console.log('getWorkingDir android');
    if (!PRODUCTION && allowDev) {
        const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
        const sdcardFolder = dirs[dirs.length - 1]?.getAbsolutePath();
        if (sdcardFolder) {
            const sdcardPath = path.join(sdcardFolder, '../../../../jules_verne');
            console.log('sd, sdcardPathcardPath', Folder.exists(sdcardPath));
            if (Folder.exists(sdcardPath)) {
                return simplify_path(sdcardPath);
            }
        }
    }
    const folder = Folder.fromPath(path.join(knownFolders.documents().path, 'data'));
    return folder.path;
}
let glassesImagesFolder;

export function getGlassesImagesFolder() {
    if (!glassesImagesFolder) {
        const folderPath = path.join(getWorkingDir(), 'glasses_images');
        if (Folder.exists(folderPath)) {
            glassesImagesFolder = folderPath;
        } else {
            glassesImagesFolder = path.join(knownFolders.currentApp().path, '/assets/data/glasses_images');
        }
    }
    return glassesImagesFolder;
}
