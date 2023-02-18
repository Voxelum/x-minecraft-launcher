/* eslint-disable no-template-curly-in-string */
import { config as dotenv } from 'dotenv'
import { Configuration, TargetConfiguration } from 'electron-builder'

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
  files: [{
    from: 'dist',
    to: '.',
  }, {
    from: '.',
    to: '.',
    filter: 'package.json',
  }],
  asarUnpack: [
    '**/*.node',
    '**/*.worker.js',
  ],
  artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',
  appx: {
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
        arch: ['x64', 'arm64'],
      },
      {
        target: 'dmg',
        arch: ['x64'],
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
    icon: 'icons/dark.ico',
    files: [
      '**/*.cs',
      '**/*.worker.js',
    ],
    target: [
      'appx',
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
    desktop: {
      MimeType: 'x-scheme-handler/xmcl',
    },
    category: 'Game',
    icon: 'icons/dark@256x256.png',
    artifactName: 'xmcl-${version}-${arch}.${ext}',
    target: [
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
    ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
} satisfies Configuration

