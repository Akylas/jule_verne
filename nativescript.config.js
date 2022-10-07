module.exports = {
    ignoredNativeDependencies: ['@nativescript-community/sentry'],
    id: 'com.akylas.juleverne',
    appResourcesPath: 'App_Resources',
    forceLog: true,
    android: {
        maxLogcatObjectSize: 2048,
        markingMode: 'none',
        // v8Flags: '--expose_gc',
        codeCache: true,
        forceLog: true
    },
    cssParser: 'rework',
    appPath: 'app',
    webpackConfigPath: './app.webpack.config.js'
};
