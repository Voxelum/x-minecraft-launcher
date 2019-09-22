const files = require.context('.', false, /\.json$/);
const locales = {};

files.keys().forEach((key) => {
    if (key.endsWith('index.json')) return; 
    locales[key.replace(/(\.\/|\.json)/g, '')] = files(key);
});

export default locales;
