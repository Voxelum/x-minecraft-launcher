const path = require('path')

module.exports = {
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm.js',
            locales: path.join(__dirname, '../locales'),
            static: path.join(__dirname, '../static'),
            universal: path.join(__dirname, '../src/universal'),
            '@universal': path.join(__dirname, '../src/universal'),
        },
        extensions: ['.js', '.vue', '.json', '.css', '.node'],
    },
}
