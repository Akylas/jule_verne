import { ApplicationSettings, Folder, knownFolders, path } from '@nativescript/core';
import * as app from '@nativescript/core/application';

export function getDataFolder() {
    let dataFolder;
    if (__ANDROID__) {
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
            dataFolder = dirs[dirs.length - 1]?.getAbsolutePath();
        }
    }
    if (!dataFolder) {
        dataFolder = knownFolders.documents().path;
    }
    // if (!PRODUCTION) {
    //     dataFolder = path.join(dataFolder, 'dev');
    // }
    return dataFolder;
}

export function getWorkingDir() {
    const folder = Folder.fromPath(path.join(knownFolders.documents().path, 'data'));
    return folder.path;
    // let localMbtilesSource = ApplicationSettings.getString('local_directory');
    // if (!localMbtilesSource) {
    //     let defaultPath = path.join(getDataFolder(), 'jules_verne');
    //     if (__ANDROID__) {
    //         const dirs = (app.android.startActivity as android.app.Activity).getExternalFilesDirs(null);
    //         const sdcardFolder = dirs[dirs.length - 1]?.getAbsolutePath();
    //         if (sdcardFolder) {
    //             defaultPath = path.join(sdcardFolder, '../../../..', 'jules_verne');
    //         }
    //     }
    //     localMbtilesSource = ApplicationSettings.getString('local_directory', defaultPath);
    // }
    // return localMbtilesSource;
}

export function getGlassesImagesFolder() {
    const folderPath = path.join(getWorkingDir(), 'glasses_images');
    console.log('getGlassesImagesFolder', getWorkingDir(), path.normalize(folderPath));
    if (Folder.exists(folderPath)) {
        return folderPath;
    }
    return path.join(knownFolders.currentApp().path, '/assets/data/glasses_images');
}

export function throttle(fn, delay) {
    let lastCalled = 0;
    return (...args) => {
        const now = new Date().getTime();
        if (now - lastCalled < delay) {
            return;
        }
        lastCalled = now;
        return fn(...args);
    };
}
