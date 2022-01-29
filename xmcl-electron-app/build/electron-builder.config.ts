import { Configuration } from 'electron-builder'
import { version } from '../package.json'

export const config: Configuration = {
  productName: 'xmcl',
  appId: 'xmcl',
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  // assign publish for auto-updater
  // set this to your own repo!
  publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],
  files: [
    'dist/**/*',
  ],
  asarUnpack: [
    '**/*.cs',
    'node_modules/7zip-bin/**/*',
    '**/*.worker.js',
  ],
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: '${productName}-${version}-${platform}-${arch}.${ext}',
  appx: {
    displayName: 'XMCL',
    applicationId: 'CI010.XMCL',
    identityName: '22961CI010.XMCL',
    backgroundColor: 'transparent',
    publisher: 'CN=DAFB9390-F5BD-4F94-828C-242F8DAA6FDE',
    publisherDisplayName: 'CI010',
    setBuildNumber: true,
    languages: ['en-US', 'zh-CN', 'ru'],
  },
  nsis: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-Setup-${version}.${ext}',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    differentialPackage: true,
  },
  nsisWeb: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-Web-Setup-${version}.${ext}',
    appPackageUrl: `https://xmcl-release.azureedge.net/releases/x-minecraft-launcher-${version}-x64.nsis.7z`,
  },
  dmg: {
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 130,
        y: 150,
        type: 'file',
      },
    ],
  },
  mac: {
    icon: 'build/icons/icon.icns',
    target: [
      {
        target: 'zip',
      },
      {
        target: 'dmg',
      },
    ],
  },
  win: {
    icon: 'build/icons/icon.ico',
    files: [
      '**/*.cs',
      'node_modules/7zip-bin/**/*',
      '!node_modules/7zip-bin/win32/ia32',
      '!node_modules/7zip-bin/linux/*',
      '!node_modules/7zip-bin/mac/*',
      '**/*.worker.js',
    ],
    target: [
      'nsis:x64',
      {
        target: 'nsis-web',
        arch: [
          'x64',
        ],
      },
      {
        target: 'zip',
        arch: [
          'x64',
          'ia32',
        ],
      },
    ],
  },
  linux: {
    icon: 'build/icons',
    target: [
      {
        target: 'deb',
      },
      {
        target: 'rpm',
      },
      {
        target: 'AppImage',
      },
      {
        target: 'snap',
      },
    ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
}
