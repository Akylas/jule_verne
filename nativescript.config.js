module.exports = {
    id: 'com.akylas.juleverne',
    appResourcesPath: 'App_Resources',
    android: {
        maxLogcatObjectSize: 2048,
        markingMode: 'none',
        v8Flags: '--expose_gc',
        codeCache: true,
        forceLog: true
    },
    appPath: 'app',
    webpackConfigPath: './app.webpack.config.js'
};
