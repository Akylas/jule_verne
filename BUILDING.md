## 1. Environment setup

Follow the [NativeScript Full Setup](https://docs.nativescript.org/environment-setup.html#setting-up-your-system) documentation.

On Ubuntu you might have to do this as well:

```bash
sudo apt-get install android-sdk-platform-tools-common
```

It is easier to maintain android SDK and tools using [Android Studio](https://developer.android.com/studio) 

If you get permission issues with the Android SDK:

```bash
sudo chgrp -R sudo /usr/local/android/sdk/
sudo chmod -R g+rw /usr/local/android/sdk/
```

To test your setup:

```bash
# This should result in "No issues were detected"
ns doctor

# With your phone plugged by USB and with dev mode enabled
ns devices android

Connected devices & emulators
Searching for devices...
┌───┬─────────────┬──────────┬───────────────────┬────────┬───────────┬─────────────────┐
│ # │ Device Name │ Platform │ Device Identifier │ Type   │ Status    │ Connection Type │
│ 1 │ daisy       │ Android  │ c1c1da8b9806      │ Device │ Connected │ USB             │
└───┴─────────────┴──────────┴───────────────────┴────────┴───────────┴─────────────────┘
```

Your phone should have status "Connected". If not visible or any other issue, something is not ready!

## 2. Application custom font icons

If the application custom font icons are create using [Icomoon](https://icomoon.io/app/#/select). 
The icomoon project file is a json at the top of the repo with the name of the app.
To update it:
* import the project in icomoon (if not done)
* modify the project/icons
* download
* put the `variables.scss` in `css/`
* put the `app.ttf` in `app/fonts`

## 5. Publishing

### Stores

The Publishing uses [Fastlane](https://fastlane.tools/). Ensure you [installed](https://docs.fastlane.tools/#installing-fastlane) it correctly:
* install `fastlane`
* install plugins with `fastlane install_plugins` in the root project
* Ensure everything is fine with your iOS dev env

The release process is like this:

* bump `versionCode` and (if needed) `versionName` in `App_Resources/android/app.gradle`
* bump `CFBundleVersion` and (if needed) `CFBundleShortVersionString` in `App_Resources/iOS/Info.plist`
* commit the  files changes because fastlane expect a clean git repo
* you can now publish (in the vscode terminal, otherwise you have to set the env variables yourself):
     - iOS AppCenter: `fastlane ios appcenter`
     - Android playstore for beta testing (right now using internal track): `fastlane android beta`

That's it the process auto generate changelogs, tags based on the conventional commits.


### fdroid

Run `fastlane android fdroid` then publish APKs from `platforms/android/app/build/outputs/apk/release` on the fdroid repo. The changelog from fastlane should be picked up by the fdroid repo.

### github

Run `fastlane android github`.