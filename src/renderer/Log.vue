<template>
  <div id="container" style="width:500px;height:300px;border:1px solid #ccc"></div>
</template>

<script>
// Monaco uses a custom amd loader that over-rides node's require.
// Keep a reference to node's require so we can restore it after executing the amd loader file.
const nodeRequire = global.require;
const loader = require('monaco-editor/dev/vs/loader');
// Save Monaco's amd require and restore Node's require
const amdRequire = global.require;
global.require = nodeRequire;
// require node modules before loader.js comes in
let path = require('path');

function uriFromPath(_path) {
    let pathName = path.resolve(_path).replace(/\\/g, '/');
    if (pathName.length > 0 && pathName.charAt(0) !== '/') {
        pathName = `/${pathName}`;
    }
    return encodeURI(`file://${pathName}`);
}

amdRequire.config({
    baseUrl: uriFromPath(path.join(__dirname, '../node_modules/monaco-editor/min')),
});

// workaround monaco-css not understanding the environment
self.module = undefined;

// workaround monaco-typescript not understanding the environment
self.process.browser = true;

amdRequire(['vs/editor/editor.main'], () => {
    let editor = monaco.editor.create(document.getElementById('container'), {
        value: [
            'function x() {',
            '\tconsole.log("Hello world!");',
            '}',
        ].join('\n'),
        language: 'javascript',
    });
});

export default {

}
</script>

<style>

</style>
