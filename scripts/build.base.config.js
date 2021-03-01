
/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  productName: "xmcl",
  appId: "xmcl",
  directories: {
    output: 'build',
    buildResources: 'build',
    app: 'dist'
  },
  // assign publish for auto-updater
  // set this to your own repo!
  publish: [{
    provider: "github",
    owner: "voxelum",
    repo: "x-minecraft-launcher"
  }],
  files: [
    // don't include node_modules as all js modules are bundled into production js by rollup
    // unless you want to prevent some module to bundle up
    // list them below
  ],
  asarUnpack: [
    "dist/static/Acrylic.cs",
    "node_modules/7zip-bin/**/*"
  ],
}

module.exports = config
