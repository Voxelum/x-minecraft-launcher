
/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
    productName: "xmcl",
    appId: "xmcl",
    directories: {
        output: "build",
    },
    publish: [{
        provider: "github",
        owner: "voxelum",
        repo: "x-minecraft-launcher"
    }],
    files: [
        "dist/electron/**/*",
        "!**/node_modules/**/*",
        "node_modules/7zip-bin/**/*"
    ],
    asarUnpack: [
        "dist/electron/static/Acrylic.cs",
        "node_modules/7zip-bin/**/*"
    ],
}

module.exports = config;
