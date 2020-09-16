const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// const BabiliWebpackPlugin = require('babili-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const { dependencies } = require('../package.json');

/**
 * List of node_modules to include in webpack bundle
 *
 * Required for specific packages like Vue UI libraries
 * that provide pure *.vue files that need compiling
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/webpack-configurations.html#white-listing-externals
 */
const whiteListedModules = [
    'vue',
    'vuetify',
    'vue-router',
    'vue-i18n',
    'vuex',
    'maven-artifact-version',
    '@vue/composition-api',
    '@xmcl/text-component',
    '@xmcl/model',
    'three',
    'three-orbit-controls',
    'vue-virtual-scroll-list'
];

/**
 * @type {import('webpack').Configuration}
 */
const rendererConfig = {
    mode: process.env.NODE_ENV,
    // devtool: 'source-map',
    devtool: '#eval-source-map',
    // devtool: '#cheap-module-eval-source-map',
    entry: {
        renderer: path.join(__dirname, '../src/renderer/windows/main/index.ts'),
        logger: path.join(__dirname, '../src/renderer/windows/logger/index.ts'),
        setup: path.join(__dirname, '../src/renderer/windows/setup/index.ts'),
    },
    externals: [
        ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d)),
    ],
    module: {
        rules: [
            {
                test: /\.styl$/,
                loader: 'css-loader!stylus-loader?paths=node_modules/bootstrap-stylus/stylus/'
            },
            {
                test: /\.css$/,
                use: ['vue-style-loader', 'css-loader'],
            },
            {
                test: /\.vue$/,
                use: {
                    loader: 'vue-loader',
                    options: {
                        extractCSS: process.env.NODE_ENV === 'production',
                        loaders: {
                            sass: 'vue-style-loader!css-loader!sass-loader?indentedSyntax=1',
                            scss: 'vue-style-loader!css-loader!sass-loader',
                        },
                    },
                },
            },
            {
                test: /\.ts$/,
                use: [
                    'cache-loader',
                    {
                        loader: 'thread-loader',
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            appendTsSuffixTo: [/\.vue$/],
                            happyPackMode: true
                        },
                    }
                ],
                exclude: /node_modules/,
                include: [path.join(__dirname, '../src/renderer'), path.join(__dirname, '../src/universal')],
            },
            {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                use: {
                    loader: 'url-loader',
                    query: {
                        limit: 10000,
                        name: 'imgs/[name].[ext]',
                    },
                },
            },
            {
                test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                use: {
                    loader: 'url-loader',
                    query: {
                        limit: 10000,
                        name: 'fonts/[name].[ext]',
                    },
                },
            },
        ],
    },
    node: {
        __dirname: process.env.NODE_ENV !== 'production',
        __filename: process.env.NODE_ENV !== 'production',
    },
    plugins: [
        // new ForkTsCheckerWebpackPlugin({
        //     vue: true,
        //     // eslint: true,
        //     tsconfig: path.resolve(__dirname, '../tsconfig.json'),
        // }),
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({ filename: 'styles.css' }),
        new HtmlWebpackPlugin({
            filename: 'main.html',
            chunks: ['renderer'],
            template: path.resolve(__dirname, '../src/index.ejs'),
            minify: {
                collapseWhitespace: true,
                removeAttributeQuotes: true,
                removeComments: true,
            },
            nodeModules: process.env.NODE_ENV !== 'production'
                ? path.resolve(__dirname, '../node_modules')
                : false,
        }),
        new HtmlWebpackPlugin({
            filename: 'logger.html',
            chunks: ['logger'],
            template: path.resolve(__dirname, '../src/index.ejs'),
            minify: {
                collapseWhitespace: true,
                removeAttributeQuotes: true,
                removeComments: true,
            },
            nodeModules: process.env.NODE_ENV !== 'production'
                ? path.resolve(__dirname, '../node_modules')
                : false,
        }),
        new HtmlWebpackPlugin({
            filename: 'setup.html',
            chunks: ['setup'],
            template: path.resolve(__dirname, '../src/index.ejs'),
            minify: {
                collapseWhitespace: true,
                removeAttributeQuotes: true,
                removeComments: true,
            },
            nodeModules: process.env.NODE_ENV !== 'production'
                ? path.resolve(__dirname, '../node_modules')
                : false,
        }),
        new webpack.NoEmitOnErrorsPlugin(),
    ],
    output: {
        filename: '[name].js',
        libraryTarget: 'var',
        path: path.join(__dirname, '../dist/electron'),
    },
    resolve: {
        alias: {
            '@renderer': path.join(__dirname, '../src/renderer'),
            '@': path.join(__dirname, '../src/renderer'),
            '@universal': path.join(__dirname, '../src/universal'),
        },
        extensions: ['.ts', '.js', '.vue', '.json', '.css', '.node'],
    },
    target: 'web',
};

/**
 * Adjust rendererConfig for development settings
 */
if (process.env.NODE_ENV !== 'production') {
    rendererConfig.plugins.push(
        new webpack.DefinePlugin({
            __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
        }),
    );
}

/**
 * Adjust rendererConfig for production settings
 */
if (process.env.NODE_ENV === 'production') {
    rendererConfig.devtool = '';

    rendererConfig.plugins.push(
        new CopyWebpackPlugin([
            {
                from: path.join(__dirname, '../static'),
                to: path.join(__dirname, '../dist/electron/static'),
                ignore: ['.*'],
            },
        ]),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': '"production"',
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: true,
        }),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            generateStatsFile: true,
            reportFilename: path.join(__dirname, '../dist/renderer.report.html'),
            statsFilename: path.join(__dirname, '../dist/renderer.stat.json'),
            openAnalyzer: false,
        }),
    );
}

module.exports = rendererConfig;
