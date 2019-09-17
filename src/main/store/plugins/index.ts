import { Plugin } from 'vuex'

const files = require.context('.', false, /\.js$/);
const modules: Plugin<any>[] = [];

files.keys().forEach((key) => {
    if (key === './index.js') return;
    modules.push(files(key).default);
});

export default modules;
