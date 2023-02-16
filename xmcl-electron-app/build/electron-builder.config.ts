import { Configuration, TargetConfiguration } from 'electron-builder'
import { config as dotenv } from 'dotenv'

dotenv()

type ArchType = TargetConfiguration['arch']
export const config = {
  productName: 'X Minecraft Launcher',
  appId: 'xmcl',
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  protocols: {
    name: 'XMCL',
    schemes: ['xmcl'],
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
    '**/assets/**/*.cs',
    '**/assets/**/*.node',
    '**/assets/**/*.lib',
    '**/assets/**/*.so',
    '**/assets/**/*.dll',
    '**/assets/**/*.vbs',
    '**/*.worker.js',
  ],
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',
  appx: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: 'xmcl-${version}.${ext}',
    displayName: 'X Minecraft Launcher',
    applicationId: 'CI010.XMCL',
    identityName: 'XMCL',
    backgroundColor: 'transparent',
    publisher: process.env.APPX_PUBLISHER ? Buffer.from(process.env.APPX_PUBLISHER!, 'base64').toString('utf8') : undefined,
    publisherDisplayName: 'CI010',
    setBuildNumber: true,
    languages: ['en-US', 'zh-CN', 'ru'],
  },
  dmg: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: 'xmcl-${version}.${ext}',
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
    icon: 'icons/dark.icns',
    darkModeSupport: true,
    target: [
      {
        target: 'zip',
        arch: 'x64' as ArchType,
      },
      {
        target: 'dmg',
        arch: 'x64' as ArchType,
      },
    ],
  },
  win: {
    extraFiles: {
      from: './build/extra',
      to: '.',
      filter: '*.dll',
    },
    certificateFile: undefined as string | undefined,
    artifactName: process.env.BUILD_TARGET === 'appx'
      // eslint-disable-next-line no-template-curly-in-string
      ? 'xmcl-${version}.${ext}'
      // eslint-disable-next-line no-template-curly-in-string
      : 'xmcl-${version}-${platform}-${arch}.${ext}',
    icon: 'icons/dark.ico',
    files: [
      '**/*.cs',
      '**/*.worker.js',
    ],
    target: [
      process.env.BUILD_TARGET === 'appx'
        ? 'appx'
        : {
          target: 'zip',
          arch: [
            'x64',
            'ia32',
          ],
        },
    ],
  },
  linux: {
    desktop: {
      MimeType: 'x-scheme-handler/xmcl',
    },
    category: 'Game',
    icon: 'icons/dark@256x256.png',
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: 'xmcl-${version}-${arch}.${ext}',
    target: process.env.BUILD_TARGET === 'appimage'
      ? [{ target: 'AppImage', arch: 'x64' as ArchType }]
      : [
        { target: 'deb', arch: 'x64' as ArchType },
        { target: 'rpm', arch: 'x64' as ArchType },
        { target: 'zip', arch: 'x64' as ArchType },
        { target: 'tar.xz', arch: 'x64' as ArchType },
      ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
} satisfies Configuration

