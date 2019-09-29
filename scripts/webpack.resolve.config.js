const path = require('path');

module.exports = {
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm.js',
            static: path.join(__dirname, '../static'),
            main: path.join(__dirname, '../src/main'),
            universal: path.join(__dirname, '../src/universal'),
            renderer: path.join(__dirname, '../src/renderer'),
            '@': path.join(__dirname, '../src/renderer'),
        },
        extensions: ['.ts', '.js', '.vue', '.json', '.css', '.node'],
    },
};
