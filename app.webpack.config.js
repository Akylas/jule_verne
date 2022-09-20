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
const Fontmin = require('@akylas/fontmin');
const IgnoreNotFoundExportPlugin = require('./IgnoreNotFoundExportPlugin');

function fixedFromCharCode(codePt) {
    if (codePt > 0xffff) {
        codePt -= 0x10000;
        return String.fromCharCode(0xd800 + (codePt >> 10), 0xdc00 + (codePt & 0x3ff));
    } else {
        return String.fromCharCode(codePt);
    }
}

module.exports = (env, params = {}) => {
    if (env.adhoc) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: true,
                uploadSentry: true,
                noconsole: true,
                sourceMap: true,
                uglify: true
            },
            env
        );
    } else if (env.timeline) {
        env = Object.assign(
            {},
            {
                production: true,
                sentry: false,
                uploadSentry: false,
                sourceMap: false,
                uglify: false
            },
            env
        );
    }
    const nconfig = require('./nativescript.config');
    const {
        appPath = nconfig.appPath,
        appResourcesPath = nconfig.appResourcesPath,
        production, // --env.production
        sourceMap, // --env.sourceMap
        hiddenSourceMap, // --env.hiddenSourceMap
        inlineSourceMap, // --env.inlineSourceMap
        sentry, // --env.sentry
        uploadSentry = true,
        uglify, // --env.uglify
        noconsole, // --env.noconsole
        reportall, // --env.reportall
        disableUpdates,
        usecrop, // --env.usecrop
        devlog, // --env.devlog
        adhoc // --env.adhoc
    } = env;
    env.appPath = appPath;
    env.appResourcesPath = appResourcesPath;
    env.appComponents = env.appComponents || [];
    env.appComponents.push(
        '~/services/android/BgService',
        '~/services/android/BgServiceBinder',
        '~/services/android/CustomMediaButtonReceiver',
        '~/services/android/BlueToothHeadSetEventReceiver',
        '~/android/ActionReceiver'
    );
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
        'tns-core-modules': `${coreModulesPackageName}`
    });
    const isIOS = platform === 'ios';
    const isAndroid = platform === 'android';
    let appVersion;
    let buildNumber;
    if (isAndroid) {
        const gradlePath = resolve(projectRoot, appResourcesPath, 'Android/app.gradle');
        const gradleData = readFileSync(gradlePath, 'utf8');
        appVersion = gradleData.match(/versionName "((?:[0-9]+\.?)+)"/)[1];
        buildNumber = gradleData.match(/versionCode ([0-9]+)/)[1];
    } else if (platform === 'ios') {
        const plistPath = resolve(projectRoot, appResourcesPath, 'iOS/Info.plist');
        const plistData = readFileSync(plistPath, 'utf8');
        appVersion = plistData.match(/<key>CFBundleShortVersionString<\/key>[\s\n]*<string>(.*?)<\/string>/)[1];
        buildNumber = plistData.match(/<key>CFBundleVersion<\/key>[\s\n]*<string>([0-9]*)<\/string>/)[1];
    }

    const locales = readdirSync(join(projectRoot, appPath, 'i18n'))
        .filter((s) => s.endsWith('.json'))
        .map((s) => s.replace('.json', ''));
    const defines = {
        SUPPORTED_LOCALES: JSON.stringify(locales),
        PRODUCTION: !!production,
        process: 'global.process',
        'global.TNS_WEBPACK': 'true',
        'global.isIOS': isIOS,
        'global.isAndroid': isAndroid,
        'global.autoLoadPolyfills': false,
        __UI_USE_EXTERNAL_RENDERER__: true,
        __UI_USE_XML_PARSER__: false,
        __APP_ID__: `"${nconfig.id}"`,
        __APP_VERSION__: `"${appVersion}"`,
        __APP_BUILD_NUMBER__: `"${buildNumber}"`,
        'global.__AUTO_REGISTER_UI_MODULES__': false,
        TNS_ENV: JSON.stringify(mode),
        'gVars.sentry': !!sentry,
        GITLAB_TOKEN: `"${process.env.GITLAB_TOKEN}"`,
        ACTIVELOOK_INTERNAL_TOKEN: `"${process.env.ACTIVELOOK_INTERNAL_TOKEN}"`,
        ACTIVELOOK_BETA_TOKEN: `"${process.env.ACTIVELOOK_BETA_TOKEN}"`,
        SENTRY_DSN: `"${process.env.SENTRY_DSN}"`,
        UPDATE_DATA_DEFAULT_URL: '"https://nextcloud.akylas.fr/index.php/s/dB8weHEM5EzxNW7/download"',
        SENTRY_PREFIX: `"${!!sentry ? process.env.SENTRY_PREFIX : ''}"`,
        NO_CONSOLE: noconsole,
        DISABLE_UPDATES: disableUpdates,
        __FORCE_BUG_REPORT__: !!reportall,
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

    const scssPrepend = `$mdi-fontFamily: ${isAndroid ? 'materialdesignicons-webfont' : 'Material Design Icons'};
    $inter-fontFamily: ${isAndroid ? 'res/inter' : 'Inter'};`;

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
                            const unicodeHex = mdiIcons[p1];
                            const numericValue = parseInt(unicodeHex, 16);
                            const character = fixedFromCharCode(numericValue);
                            usedMDIICons.push(numericValue);
                            return character;
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
            // Buffer: ['buffer', 'Buffer']
        })
    );
    // handle node polyfills
    // config.externals.push('fs');
    config.externalsPresets = { node: false };
    config.resolve.fallback = config.resolve.fallback || {};
    // config.resolve.fallback.buffer = require.resolve('buffer/');
    config.resolve.fallback.buffer = false;
    // config.resolve.fallback.util = require.resolve('util/');
    config.resolve.fallback.util = false;
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
            transform: production
                ? {
                      transformer(content, path) {
                          return new Promise((resolve, reject) => {
                              new Fontmin()
                                  .src(content)
                                  .use(Fontmin.glyph({ subset: usedMDIICons }))
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
                : undefined
        }
    ];
    copyPatterns.push({ from: 'test_assets/**/*', to: 'assets/[name][ext]', noErrorOnMissing: false, globOptions });

    Object.assign(config.plugins.find((p) => p.constructor.name === 'DefinePlugin').definitions, defines);

    config.plugins.unshift(new CopyWebpackPlugin({ patterns: copyPatterns }));
    config.plugins.push(new IgnoreNotFoundExportPlugin());
    config.plugins.push(new webpack.ContextReplacementPlugin(/dayjs[\/\\]locale$/, new RegExp(`(${locales.join('|')})$`)));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /reduce-css-calc$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /punnycode$/ }));
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^url$/ }));

    config.plugins.unshift(
        new webpack.ProvidePlugin({
            setTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setTimeout'],
            clearTimeout: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearTimeout'],
            setImmediate: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setImmediate'],
            setInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'setInterval'],
            clearInterval: [require.resolve(coreModulesPackageName + '/timer/index.' + platform), 'clearInterval'],
            FormData: [require.resolve(coreModulesPackageName + '/polyfills/formdata'), 'FormData'],
            requestAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'requestAnimationFrame'],
            cancelAnimationFrame: [require.resolve(coreModulesPackageName + '/animation-frame'), 'cancelAnimationFrame']
        })
    );
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

    // if (!!production) {
    //     config.plugins.push(
    //         new ForkTsCheckerWebpackPlugin({
    //             async: false,
    //             typescript: {
    //                 configFile: resolve(tsconfig)
    //             }
    //         })
    //     );
    // }
    config.optimization.splitChunks.cacheGroups.defaultVendor.test = /[\\/](node_modules|nativescript-carto|NativeScript[\\/]dist[\\/]packages[\\/]core)[\\/]/;
    config.optimization.minimize = uglify !== undefined ? uglify : production;
    const isAnySourceMapEnabled = !!sourceMap || !!hiddenSourceMap || !!inlineSourceMap;
    config.optimization.minimizer = [
        new TerserPlugin({
            parallel: true,
            terserOptions: {
                ecma: 2017,
                module: false,
                toplevel: false,
                keep_classnames: false,
                keep_fnames: false,
                output: {
                    comments: false,
                    semicolons: !isAnySourceMapEnabled
                },
                mangle: {
                    properties: {
                        reserved: ['__metadata'],
                        regex: /^(m[A-Z])/
                    }
                },
                compress: {
                    booleans_as_integers: false,
                    // The Android SBG has problems parsing the output
                    // when these options are enabled
                    collapse_vars: platform !== 'android',
                    sequences: platform !== 'android',
                    passes: 2,
                    drop_console: production && !sentry && noconsole
                }
            }
        })
    ];
    return config;
};
