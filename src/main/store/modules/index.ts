/**
 * The file enables `universal/store/index.js` to import all vuex modules
 * in a one-shot manner. There should not be any reason to edit this file.
 */

const files = require.context('.', false, /\.ts$/);
const modules: import('vuex').ModuleTree<import('universal/store/store').BaseState> = {};

files.keys().forEach((key) => {
    if (key === './index.ts') return;
    modules[key.replace(/(\.\/|\.ts)/g, '')] = files(key).default;
});

export default modules;
