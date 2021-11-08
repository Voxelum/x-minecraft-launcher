const { join, resolve } = require("path");
const { external } = require("../package.json");
// const { default: vue } = require('@vitejs/plugin-vue')
const { createVuePlugin } = require("vite-plugin-vue2");
const { readdirSync } = require("fs");
const { VitePWA } = require("vite-plugin-pwa");
const WindiCSS = require('vite-plugin-windicss')

const entries = readdirSync(join(__dirname, "../src/renderer"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(__dirname, "../src/renderer", f));

/**
 * Vite shared config, assign alias and root dir
 * @type {import('vite').UserConfig}
 */
const config = {
    root: join(__dirname, "../src/renderer"),
    base: "", // has to set to empty string so the html assets path will be relative
    build: {
        rollupOptions: {
            input: entries,
        },
        outDir: resolve(__dirname, "../dist/renderer"),
        assetsInlineLimit: 0,
    },
    resolve: {
        alias: {
            "/@shared": join(__dirname, "../src/shared"),
            "/@": join(__dirname, "../src/renderer"),
        },
    },
    optimizeDeps: {
        exclude: external,
    },
    plugins: [
        createVuePlugin(),
        VitePWA({
            registerType: "autoUpdate",
            manifest: {
                name: "x-minecraft-launcher",
            },
        }),
        WindiCSS.default({
            // config: {
            //     extract: {
            //         include: [join(__dirname, '../src')],
            //         exclude: ['**/node_modules/**', '.git'],
            //     }
            // },
            scan: {
                dirs: [join(__dirname, '../src')],
                fileExtensions: ['vue', 'ts']
            }
        }),
    ],
};

module.exports = config;
