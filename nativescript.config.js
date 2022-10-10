module.exports = {
    ignoredNativeDependencies: ['@nativescript-community/sentry'],
    id: 'com.akylas.juleverne',
    appResourcesPath: 'App_Resources',
    forceLog: true,
    android: {
        markingMode: 'none',
        codeCache: true,
    },
    cssParser: 'rework',
    appPath: 'app',
    webpackConfigPath: './app.webpack.config.js',
    hooks: [
        {
            type: 'after-prepareNativeApp',
            script: 'scripts/after-prepareNativeApp.js'
        }
    ]
};
