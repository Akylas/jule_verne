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
NsVueTemplateCompiler.registerElement('DatePickerField', () => require('@nativescript/datetimepicker').DatePickerField, {
    model: {
        prop: 'date',
        event: 'dateChange'
    }
});
NsVueTemplateCompiler.registerElement('Pager', () => require('@nativescript-community/ui-pager').Pager, {
    model: {
        prop: 'selectedIndex',
        event: 'selectedIndexChange'
    }
});
const webpackConfig = require('./webpack.config.js');
const webpack = require('webpack');
const { readdirSync, readFileSync } = require('fs');
const { dirname, join, relative, resolve, sep } = require('path');
const nsWebpack = require('@nativescript/webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const SentryCliPlugin = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const Fontmin = require('fontmin');
const IgnoreNotFoundExportPlugin = require('./IgnoreNotFoundExportPlugin');

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
        uploadSentry = true,
        importDevData = true,
        verbose, // --env.verbose
        uglify, // --env.uglify
        noconsole, // --env.noconsole
        devlog, // --env.devlog
        dblog, // --env.dblog
        adhoc // --env.adhoc
    } = env;
    env.appPath = appPath;
    env.appResourcesPath = appResourcesPath;
    env.appComponents = env.appComponents || [];
    env.appComponents.push('~/services/android/BgService', '~/services/android/BgServiceBinder');
    const config = webpackConfig(env, params);
    const mode = production ? 'production' : 'development';
    const platform = env && ((env.android && 'android') || (env.ios && 'ios'));
    const tsconfig = 'tsconfig.json';
    const projectRoot = params.projectRoot || __dirname;
    const dist = nsWebpack.Utils.platform.getDistPath();
    const appResourcesFullPath = resolve(projectRoot, appResourcesPath);

    config.externals.push('~/licenses.json');
    config.externals.push(function ({ context, request }, cb) {
        if (/i18n$/i.test(context)) {
            return cb(null, './i18n/' + request);
        }
        cb();
    });

    const coreModulesPackageName = '@akylas/nativescript';
    config.resolve.modules = [resolve(__dirname, `node_modules/${coreModulesPackageName}`), resolve(__dirname, 'node_modules'), `node_modules/${coreModulesPackageName}`, 'node_modules'];

    // config.resolve.symlinks = false;
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

    const package = require('./package.json');
    const isIOS = platform === 'ios';
    const isAndroid = platform === 'android';
    const APP_STORE_ID = process.env.IOS_APP_ID;
    const locales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));
    const defines = {
        SUPPORTED_LOCALES: JSON.stringify(locales),
        PRODUCTION: !!production,
        process: 'global.process',
        'global.TNS_WEBPACK': 'true',
        'global.isIOS': platform === 'ios',
        'global.isAndroid': platform === 'android',
        TNS_ENV: JSON.stringify(mode),
        'gVars.sentry': !!sentry,
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        LOG_LEVEL: devlog ? '"full"' : '""',
        NO_CONSOLE: noconsole,
        TEST_LOGS: adhoc || !production,
        DEV_LOG: !!devlog,
        TEST_LOGS: !!adhoc || !production
    };

    const symbolsParser = require('scss-symbols-parser');
    const mdiSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'node_modules/@mdi/font/scss/_variables.scss')).toString());
    const mdiIcons = JSON.parse(`{${mdiSymbols.variables[mdiSymbols.variables.length - 1].value.replace(/" (F|0)(.*?)([,\n]|$)/g, '": "$1$2"$3')}}`);
    // const appSymbols = symbolsParser.parseSymbols(readFileSync(resolve(projectRoot, 'css/variables.scss')).toString());
    // const appIcons = {};
    // appSymbols.variables
    //     .filter((v) => v.name.startsWith('$icon-'))
    //     .forEach((v) => {
    //         appIcons[v.name.replace('$icon-', '')] = String.fromCharCode(parseInt(v.value.slice(2), 16));
    //     });

    const scssPrepend = `$mdi-fontFamily: ${platform === 'android' ? 'materialdesignicons-webfont' : 'Material Design Icons'};`;

    const scssLoaderRuleIndex = config.module.rules.findIndex((r) => r.test && r.test.toString().indexOf('scss') !== -1);
    config.module.rules.splice(
        scssLoaderRuleIndex,
        1,
        {
            test: /app\.scss$/,
            use: [
                { loader: 'apply-css-loader' },
                {
                    loader: 'css2json-loader',
                    options: { useForImports: true }
                },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        },
        {
            test: /\.module\.scss$/,
            use: [
                { loader: 'css-loader', options: { url: false } },
                {
                    loader: 'sass-loader',
                    options: {
                        sourceMap: false,
                        additionalData: scssPrepend
                    }
                }
            ]
        }
    );

    const usedMDIICons = [];
    config.module.rules.push({
        // rules to replace mdi icons and not use nativescript-font-icon
        test: /\.(ts|js|scss|css|vue)$/,
        exclude: /node_modules/,
        use: [
            {
                loader: 'string-replace-loader',
                options: {
                    search: '__PACKAGE_NAME__',
                    replace: nconfig.id
                }
            },
            {
                loader: 'string-replace-loader',
                options: {
                    search: 'mdi-([a-z-]+)',
                    replace: (match, p1, offset, str) => {
                        if (mdiIcons[p1]) {
                            const res = String.fromCharCode(parseInt(mdiIcons[p1], 16));
                            usedMDIICons.push(res);
                            return res;
                        }
                        return match;
                    },
                    flags: 'g'
                }
            }
        ]
    });

    if (!!production) {
        config.module.rules.push({
            // rules to replace mdi icons and not use nativescript-font-icon
            test: /\.(js)$/,
            use: [
                {
                    loader: 'string-replace-loader',
                    options: {
                        search: '__decorate\\(\\[((.|\n)*?)profile,((.|\n)*?)\\],.*?,.*?,.*?\\);?',
                        replace: (match, p1, offset, str) => '',
                        flags: 'g'
                    }
                }
            ]
        });
        // rules to clean up all Trace in production
        // we must run it for all files even node_modules
        config.module.rules.push({
            test: /\.(ts|js)$/,
            use: [
                {
                    loader: 'string-replace-loader',
                    options: {
                        search: 'if\\s*\\(\\s*Trace.isEnabled\\(\\)\\s*\\)',
                        replace: 'if (false)',
                        flags: 'g'
                    }
                }
            ]
        });
    }

    // we remove default rules
    config.plugins = config.plugins.filter((p) => ['CopyPlugin', 'ForkTsCheckerWebpackPlugin'].indexOf(p.constructor.name) === -1);

    config.plugins.push(
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer']
        })
    );
    // handle node polyfills
    // config.externals.push('fs');
    config.externalsPresets = { node: false };
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback.buffer = require.resolve('buffer/');
    config.resolve.fallback.util = require.resolve('util/');
    config.resolve.fallback.path = false;
    config.resolve.fallback.fs = false;
    config.resolve.fallback.assert = false;
    config.resolve.fallback.tty = false;
    config.resolve.fallback.os = false;

    const globOptions = { dot: false, ignore: [`**/${relative(appPath, appResourcesFullPath)}/**`] };
    const context = nsWebpack.Utils.platform.getEntryDirPath();
    const copyPatterns = [
        { context, from: 'fonts/!(ios|android)/**/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: 'fonts/*', to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: `fonts/${platform}/**/*`, to: 'fonts/[name][ext]', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.jpg', noErrorOnMissing: true, globOptions },
        { context, from: '**/*.png', noErrorOnMissing: true, globOptions },
        { context, from: 'assets/**/*', noErrorOnMissing: true, globOptions },
        { context, from: 'i18n/**/*', globOptions },
        {
            from: 'node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf',
            to: 'fonts',
            globOptions,
            transform: {
                cache: { keys: { key: usedMDIICons.join('') } },
                transformer(content, path) {
                    return new Promise((resolve, reject) => {
                        new Fontmin()
                            .src(content)
                            .use(Fontmin.glyph({ text: usedMDIICons.join('') }))
                            .run(function (err, files) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(files[0].contents);
                                }
                            });
                    });
                }
            }
        }
    ];
    copyPatterns.push({ from: 'test_assets/**/*', to: 'assets/[name][ext]', noErrorOnMissing: false, globOptions });
    // if (importDevData) {
    //     copyPatterns.push({ from: 'testassets/**/*', to: 'assets/[name][ext]', noErrorOnMissing: true, globOptions });
    // }
    // we add our rules
    config.plugins.unshift(new CopyWebpackPlugin({ patterns: copyPatterns }));
    config.plugins.push(new IgnoreNotFoundExportPlugin());
    Object.assign(config.plugins.find((p) => p.constructor.name === 'DefinePlugin').definitions, defines);
    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${locales.join('|')})$`)));

    if (nconfig.cssParser !== 'css-tree') {
        config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /css-tree$/ }));
    }
    // config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /sha.js$/ }));

    if (hiddenSourceMap || sourceMap) {
        if (!!sentry && !!uploadSentry) {
            config.devtool = false;
            config.plugins.push(
                new webpack.SourceMapDevToolPlugin({
                    append: `\n//# sourceMappingURL=${process.env.SENTRY_PREFIX}[name].js.map`,
                    filename: join(process.env.SOURCEMAP_REL_DIR, '[name].js.map')
                })
            );
            let appVersion;
            let buildNumber;
            if (platform === 'android') {
                appVersion = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(/versionName "((?:[0-9]+\.?)+)"/)[1];
                buildNumber = readFileSync('app/App_Resources/Android/app.gradle', 'utf8').match(/versionCode ([0-9]+)/)[1];
            } else if (platform === 'ios') {
                appVersion = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
                buildNumber = readFileSync('app/App_Resources/iOS/Info.plist', 'utf8').match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
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
            config.devtool = 'inline-nosources-cheap-module-source-map';
        }
    } else {
        config.devtool = false;
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
            // cache: true,
            // sourceMap: isAnySourceMapEnabled,
            terserOptions: {
                ecma: 2017,
                module: true,
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
