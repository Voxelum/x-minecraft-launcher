const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const { dependencies } = require('../package.json');

/**
 * @type {import('webpack').Configuration}
 */
const mainConfig = {
    mode: process.env.NODE_ENV,
    devtool: 'source-map',
    // devtool: 'cheap-module-eval-source-map',
    // devtool: '#eval-source-map',
    entry: {
        main: path.join(__dirname, '../src/main/main.ts'),
    },
    externals: [
        ...Object.keys(dependencies || {}),
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: process.env.NODE_ENV === 'development' ? [
                    'cache-loader',
                    {
                        loader: 'thread-loader',
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            happyPackMode: true,
                            // transpileOnly: true,
                        }
                    }
                ] : [{ loader: 'ts-loader', }],
                exclude: /node_modules/,
                include: [path.join(__dirname, '../src/main'), path.join(__dirname, '../src/universal')],
            },
            {
                test: /\.node$/,
                use: 'node-loader',
            },
        ],
    },
    node: {
        __dirname: process.env.NODE_ENV !== 'production',
        __filename: process.env.NODE_ENV !== 'production',
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                cache: true,
                parallel: true,
                sourceMap: true,
                extractComments: true,
                terserOptions: {
                    ecma: 6,
                    keep_classnames: true,
                },
            })
        ],
    },
    output: {
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        path: path.join(__dirname, '../dist/electron'),
    },
    plugins: [
        new webpack.NoEmitOnErrorsPlugin(),
        // new ForkTsCheckerWebpackPlugin({
        //     // eslint: true,
        //     tsconfig: path.resolve(__dirname, '../tsconfig.json'),
        // }),
    ],
    resolve: {
        extensions: ['.js', '.ts', '.json', '.node'],
        alias: {
            '@main': path.join(__dirname, '../src/main'),
            main: path.join(__dirname, '../src/main'),
            universal: path.join(__dirname, '../src/universal'),
            '@universal': path.join(__dirname, '../src/universal'),
        },
    },
    target: 'electron-main',
};

/**
 * Adjust mainConfig for development settings
 */
if (process.env.NODE_ENV !== 'production') {
    mainConfig.devtool = 'source-map';
    mainConfig.plugins.push(
        new webpack.DefinePlugin({
            __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
        }),
    );
}

/**
 * Adjust mainConfig for production settings
 */
if (process.env.NODE_ENV === 'production') {
    // mainConfig.externals = mainConfig.externals.filter(v => !v.startsWith('@xmcl'));
    mainConfig.externals = ['7z-bin'];
    mainConfig.plugins.push(
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': '"production"',
            'process.env.BUILD_NUMBER': process.env.BUILD_NUMBER,
        }),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            generateStatsFile: true,
            reportFilename: path.join(__dirname, '../dist/main.report.html'),
            statsFilename: path.join(__dirname, '../dist/main.stat.json'),
            openAnalyzer: false,
        }),
    );
}

module.exports = mainConfig;
