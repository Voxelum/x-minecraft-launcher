const baseConfig = require('./build.base.config')
const { version } = require('../package.json')

/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  ...baseConfig,
  nsis: {
    artifactName: '${productName}-Setup-${version}.${ext}',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    differentialPackage: true
  },
  nsisWeb: {
    artifactName: '${productName}-Web-Setup-${version}.${ext}',
    appPackageUrl: `https://xmcl-release.azureedge.net/releases/x-minecraft-launcher-${version}-x64.nsis.7z`,
  },
  dmg: {
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 150,
        type: 'file'
      }
    ]
  },
  mac: {
    icon: 'build/icons/icon.icns',
    target: [
      {
        target: 'zip'
      },
      {
        target: 'dmg'
      }
    ]
  },
  win: {
    icon: 'build/icons/icon.ico',
    target: [
      'nsis:x64',
      {
        target: 'nsis-web',
        arch: [
          'x64',
        ]
      },
      {
        target: 'zip',
        arch: [
          'x64'
        ]
      }
    ]
  },
  linux: {
    icon: 'build/icons',
    target: [
      {
        target: 'deb'
      },
      {
        target: 'rpm'
      },
      {
        target: 'AppImage'
      },
      {
        target: 'snap'
      }
    ]
  },
  snap: {
    publish: [
      'github'
    ]
  }
}

module.exports = config
