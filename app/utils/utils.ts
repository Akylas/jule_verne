import { knownFolders, path } from '@nativescript/core/file-system';
import * as app from '@nativescript/core/application';


export function getDataFolder() {
    let dataFolder;
    if (global.isAndroid) {
        const checkExternalMedia = function () {
            let mExternalStorageAvailable = false;
            let mExternalStorageWriteable = false;
            const state = android.os.Environment.getExternalStorageState();

            if (android.os.Environment.MEDIA_MOUNTED === state) {
                // Can read and write the media
                mExternalStorageAvailable = mExternalStorageWriteable = true;
            } else if (android.os.Environment.MEDIA_MOUNTED_READ_ONLY === state) {
                // Can only read the media
                mExternalStorageAvailable = true;
                mExternalStorageWriteable = false;
            } else {
                // Can't read or write
                mExternalStorageAvailable = mExternalStorageWriteable = false;
            }
            return mExternalStorageWriteable;
        };
        if (checkExternalMedia()) {
            const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
            dataFolder = dirs[dirs.length - 1].getAbsolutePath();
        } else {
            dataFolder = knownFolders.documents().path;
        }
    } else {
        dataFolder = knownFolders.documents().path;
    }
    if (!PRODUCTION) {
        dataFolder = path.join(dataFolder, 'dev');
    }
    return dataFolder;
}