const webpack = require('@nativescript/webpack');
module.exports = (env) => {
    webpack.init(env);
    // webpack.chainWebpack((config, env) => {
    //     config.target('electron-main');
    // });
    return webpack.resolveConfig();
};
