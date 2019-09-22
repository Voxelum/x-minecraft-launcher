import { Plugin } from 'vuex'

const files = require.context('.', false, /\.ts$/);
const modules: Plugin<any>[] = [];

files.keys().forEach((key) => {
    if (key === './index.ts') return;
    modules.push(files(key).default);
});

export default modules;
