const NsVueTemplateCompiler = require('nativescript-vue-template-compiler');
NsVueTemplateCompiler.registerElement('MDTextField', () => require('@nativescript-community/ui-material-textfield').TextField, {
    model: {
        prop: 'text',
        event: 'textChange'
    }
});
NsVueTemplateCompiler.registerElement('MDSlider', () => require('@nativescript-community/ui-material-slider').Slider, {
    model: {
        prop: 'value',
        event: 'valueChange'
    }
});
NsVueTemplateCompiler.registerElement('Pager', () => require('@nativescript-community/ui-pager').Pager, {
    model: {
        prop: 'selectedIndex',
        event: 'selectedIndexChange'
    }
});
const webpackConfig = require('./webpack.config.js');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const { readFileSync, readdirSync } = require('fs');
const { dirname, join, relative, resolve, sep } = require('path');
const nsWebpack = require('@nativescript/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const SentryCliPlugin = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, params = {}) => {
    if (env.adhoc) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: true,
                uploadSentry: true,
                sourceMap: true,
                uglify: true
            },
            env
        );
    }
    const nconfig = require('./nativescript.config');
    const {
        appPath = nconfig.appPath,
        appResourcesPath = nconfig.appResourcesPath,
        hmr, // --env.hmr
        production, // --env.production
        sourceMap, // --env.sourceMap
        hiddenSourceMap, // --env.hiddenSourceMap
        inlineSourceMap, // --env.inlineSourceMap
        sentry, // --env.sentry
        uploadSentry,
        verbose, // --env.verbose
        uglify, // --env.uglify
        noconsole, // --env.noconsole
        devlog, // --env.devlog
        adhoc // --env.adhoc
    } = env;

    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    const mode = production ? 'production' : 'development';
    const tsconfig = 'tsconfig.json';
    const projectRoot = params.projectRoot || __dirname;
    const dist = resolve(projectRoot, nsWebpack.getAppPath(platform, projectRoot));
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);

    if (platform === 'android') {
        env.appComponents = [resolve(projectRoot, 'app/services/android/BgService.ts'), resolve(projectRoot, 'app/services/android/BgServiceBinder.ts')];
    }
    const config = webpackConfig(env, params);
    const coreModulesPackageName = '@akylas/nativescript';
    config.resolve.modules = [resolve(__dirname, `node_modules/${coreModulesPackageName}`), resolve(__dirname, 'node_modules'), `node_modules/${coreModulesPackageName}`, 'node_modules'];
    Object.assign(config.resolve.alias, {
        '@nativescript/core': `${coreModulesPackageName}`,
        'tns-core-modules': `${coreModulesPackageName}`,
        '@nativescript-community/typeorm': '@nativescript-community/typeorm/browser',
        './nativescript/NativescriptDriver': '@akylas/nativescript-sqlite/typeorm/NativescriptDriver',
        '../driver/nativescript/NativescriptDriver': '@akylas/nativescript-sqlite/typeorm/NativescriptDriver',
        '../driver/expo/ExpoDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './expo/ExpoDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/sqljs/SqljsDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './sqljs/SqljsDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/cordova/CordovaDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './cordova/CordovaDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/react-native/ReactNativeDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './react-native/ReactNativeDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/aurora-data-api/AuroraDataApiDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './aurora-data-api/AuroraDataApiDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/aurora-data-api-pg/AuroraDataApiPostgresDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './aurora-data-api-pg/AuroraDataApiPostgresDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/cockroachdb/CockroachDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './cockroachdb/CockroachDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/postgres/PostgresDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './postgres/PostgresDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/oracle/OracleDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './oracle/OracleDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/sap/SapDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './sap/SapDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/mysql/MysqlDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './mysql/MysqlDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/sqlserver/SqlServerDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './sqlserver/SqlServerDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/mongodb/MongoDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './mongodb/MongoDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/mongodb/MongoQueryRunner': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './mongodb/MongoQueryRunner': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './entity-manager/MongoEntityManager': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../entity-manager/MongoEntityManager': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './repository/MongoRepository': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './repository/MongoRepository': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/sqlite/SqliteDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './sqlite/SqliteDriver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../driver/better-sqlite3/BetterSqlite3Driver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        './better-sqlite3/BetterSqlite3Driver': '@nativescript-community/typeorm/browser/platform/BrowserDisabledDriversDummy',
        '../util/DirectoryExportedClassesLoader': '@nativescript-community/typeorm/browser/platform/BrowserDirectoryExportedClassesLoader',
        './logger/FileLogger': '@nativescript-community/typeorm/browser/platform/BrowserFileLoggerDummy',
        './logger/DebugLogger': '@nativescript-community/typeorm/browser/platform/BrowserFileLoggerDummy',
        './FileLogger': '@nativescript-community/typeorm/browser/platform/BrowserFileLoggerDummy',
        './DebugLogger': '@nativescript-community/typeorm/browser/platform/BrowserFileLoggerDummy',
        './connection/ConnectionOptionsReader': '@nativescript-community/typeorm/browser/platform/BrowserConnectionOptionsReaderDummy',
        '../connection/ConnectionOptionsReader': '@nativescript-community/typeorm/browser/platform/BrowserConnectionOptionsReaderDummy',
        './options-reader/ConnectionOptionsXmlReader': '@nativescript-community/typeorm/browser/platform/BrowserConnectionOptionsReaderDummy',
        './options-reader/ConnectionOptionsYmlReader': '@nativescript-community/typeorm/browser/platform/BrowserConnectionOptionsReaderDummy',
        './platform/PlatformTools': '@nativescript-community/typeorm/browser/platform/BrowserPlatformTools',
        '../platform/PlatformTools': '@nativescript-community/typeorm/browser/platform/BrowserPlatformTools',
        '../../platform/PlatformTools': '@nativescript-community/typeorm/browser/platform/BrowserPlatformTools'
    });

    const nativescriptLib = require(env.nativescriptLibPath);
    const nsConfig = nativescriptLib.projectDataService.getProjectData().nsConfig;
    const locales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));
    const defines = {
        PRODUCTION: !!production,
        process: 'global.process',
        'global.TNS_WEBPACK': 'true',
        'gVars.platform': `"${platform}"`,
        'global.isIOS': platform === 'ios',
        'global.isAndroid': platform === 'android',
        TNS_ENV: JSON.stringify(mode),
        SUPPORTED_LOCALES: JSON.stringify(locales),
        'gVars.sentry': !!sentry,
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        DEV_LOG: devlog,
        NO_CONSOLE: noconsole,
        TEST_LOGS: adhoc || !production
    };

    const itemsToClean = [`${dist}/**/*`];
    if (platform === 'android') {
        itemsToClean.push(`${join(projectRoot, 'platforms', 'android', 'app', 'src', 'main', 'assets', 'snapshots/**/*')}`);
        itemsToClean.push(`${join(projectRoot, 'platforms', 'android', 'app', 'build', 'configurations', 'nativescript-android-snapshot')}`);
    }

    const symbolsParser = require('scss-symbols-parser');
    const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    const scssPrepend = `
        $mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    `;

    config.module.rules.forEach((r) => {
        if (Array.isArray(r.use) && r.use.indexOf('sass-loader') !== -1) {
            r.use.splice(-1, 1, {
                loader: 'sass-loader',
                options: {
                    sourceMap: false,
                    additionalData: scssPrepend
                }
            });
        }
    });
    const indexOfTsLoaderRule = config.module.rules.findIndex((r) => r.loader === 'ts-loader');
    config.module.rules[indexOfTsLoaderRule].options.transpileOnly = true;

    config.module.rules.push({
        // rules to replace mdi icons and not use nativescript-font-icon
        test: /\.(ts|js|scss|css|vue)$/,
        exclude: /node_modules/,
        use: [
            {
                loader: 'string-replace-loader',
                options: {
                    search: '__PACKAGE_NAME__',
                    replace: nsConfig.id
                }
            },
            {
                loader: 'string-replace-loader',
                options: {
                    search: 'mdi-([a-z-]+)',
                    replace: (match, p1, offset, str) => {
                        if (mdiIcons[p1]) {
                            return String.fromCharCode(parseInt(mdiIcons[p1], 16));
                        }
                        return match;
                    },
                    flags: 'g'
                }
            }
        ]
    });

    // we remove default rules
    config.plugins = config.plugins.filter((p) => ['DefinePlugin', 'CleanWebpackPlugin', 'CopyPlugin'].indexOf(p.constructor.name) === -1);
    // we add our rules
    const copyIgnore = {
        ignore: [`**/${relative(appPath, appResourcesFullPath)}/**`]
    };
    const copyPatterns = [
        {
            from: 'fonts/!(ios|android|watch)/**/*',
            to: 'fonts',
            flatten: true,
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: 'fonts/*',
            to: 'fonts',
            flatten: true,
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: `fonts/${platform}/**/*`,
            to: 'fonts',
            flatten: true,
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: '**/*.jpg',
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: '**/*.png',
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: 'assets/**/*',
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        },
        {
            from: '../node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf',
            to: 'fonts',
            noErrorOnMissing: true,
            globOptions: { dot: false, ...copyIgnore }
        }
    ];
    if (!production) {
        copyPatterns.push({ from: '../test_assets/**/*', to: 'assets', flatten: true });
    }
    // we add our rules
    config.plugins.unshift(
        new CopyWebpackPlugin({
            patterns: copyPatterns
        })
    );
    config.plugins.unshift(
        new CleanWebpackPlugin({
            dangerouslyAllowCleanPatternsOutsideProject: true,
            dry: false,
            verbose: false,
            cleanOnceBeforeBuildPatterns: itemsToClean
        })
    );
    config.plugins.unshift(new webpack.DefinePlugin(defines));
    config.plugins.push(
        new webpack.EnvironmentPlugin({
            NODE_ENV: JSON.stringify(mode), // use 'development' unless process.env.NODE_ENV is defined
            DEBUG: false
        })
    );

    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${locales.join('|')})$`)));
    // if (nsConfig.cssParser !== 'css-tree') {
    //     config.plugins.push(new webpack.IgnorePlugin(/css-tree/));
    // }

    config.devtool = inlineSourceMap ? 'inline-cheap-source-map' : false;
    if (!inlineSourceMap && (hiddenSourceMap || sourceMap)) {
        if (!!sentry && !!uploadSentry) {
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    append: `\n//# sourceMappingURL=${process.env.SENTRY_PREFIX}[name].js.map`,
                    filename: join(process.env.SOURCEMAP_REL_DIR, '[name].js.map')
                })
            );
            let appVersion;
            let buildNumber;
            if (platform === 'android') {
                appVersion = readFileSync(join(appResourcesPath, 'Android/app.gradle'), 'utf8').match(/versionName "((?:[0-9]+\.?)+)"/)[1];
                buildNumber = readFileSync(join(appResourcesPath, 'Android/app.gradle'), 'utf8').match(/versionCode ([0-9]+)/)[1];
            } else if (platform === 'ios') {
                appVersion = readFileSync(join(appResourcesPath, 'iOS/Info.plist'), 'utf8').match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
                buildNumber = readFileSync(join(appResourcesPath, 'iOS/Info.plist'), 'utf8').match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
            }
            console.log('appVersion', appVersion, buildNumber);

            config.plugins.push(
                new SentryCliPlugin({
                    release: appVersion,
                    urlPrefix: 'app:///',
                    rewrite: true,
                    dist: `${buildNumber}.${platform}`,
                    ignore: ['tns-java-classes', 'hot-update'],
                    include: [dist, join(dist, process.env.SOURCEMAP_REL_DIR)]
                })
            );
        } else {
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    filename: '[name].js.map'
                })
            );
        }
    }
    if (!!production) {
        config.plugins.push(
            new ForkTsCheckerWebpackPlugin({
                async: false,
                typescript: {
                    configFile: resolve(tsconfig)
                }
            })
        );
    }
    config.optimization.minimize = uglify !== undefined ? uglify : production;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    config.optimization.minimizer = [
        new TerserPlugin({
            parallel: true,
            cache: true,
            sourceMap: isAnySourceMapEnabled,
            terserOptions: {
                ecma: 6,
                // warnings: true,
                // toplevel: true,
                output: {
                    comments: false,
                    semicolons: !isAnySourceMapEnabled
                },
                compress: {
                    // The Android SBG has problems parsing the output
                    // when these options are enabled
                    collapse_vars: platform !== 'android',
                    sequences: platform !== 'android',
                    passes: 2,
                    drop_console: production && adhoc !== true
                },
                keep_fnames: true
            }
        })
    ];
    return config;
};
