const path = require('path');

/**
 * @type {import('webpack').Configuration}
 */
const config = {
    resolve: {
        alias: {
            static: path.join(__dirname, '../static'),
            '@static': path.join(__dirname, '../static'),
            main: path.join(__dirname, '../src/main'),
            '@main': path.join(__dirname, '../src/main'),
            universal: path.join(__dirname, '../src/universal'),
            '@universal': path.join(__dirname, '../src/universal'),
            renderer: path.join(__dirname, '../src/renderer'),
            '@': path.join(__dirname, '../src/renderer'),
        },
        extensions: ['.ts', '.js', '.vue', '.json', '.css', '.node'],
    },
};

module.exports = config;
