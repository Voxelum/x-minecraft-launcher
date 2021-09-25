const { join } = require("path");
const { readFile } = require("fs-extra");

const nodeModules = new RegExp(/^.+[\\\/]node_modules[\\\/].+[\\\/]7zip-bin[\\\/]index\.js$/);

/**
 * Correctly handle 7za bin import.
 * @param {string} nodeModules
 * @returns {import('esbuild').Plugin}
 */
module.exports = function create7ZipBinPlugin(nodeModules) {
    return {
        name: "resolve-7zip-bin",
        setup(build) {
            if (build.initialOptions.watch) {
                build.onLoad(
                    { filter: /^.+[\\\/]node_modules[\\\/].+[\\\/]7zip-bin[\\\/]index\.js$/g },
                    async ({ path }) => {
                        const content = await readFile(path, "utf-8");
                        return {
                          contents: content.replace(/__dirname/g, JSON.stringify(join(nodeModules, '7zip-bin'))),
                          loader: "js",
                        };
                      }
                );
            }
        },
    };
};
