/* eslint-disable no-template-curly-in-string */
import { config as dotenv } from 'dotenv'
import type { Configuration } from 'electron-builder'

dotenv()

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
    filter: ['**/*.js', '**/*.ico', '**/*.png', '**/*.webp', '**/*.svg', '*.node', '**/*.html', '**/*.css', '**/*.woff2'],
  }, {
    from: '.',
    to: '.',
    filter: 'package.json',
  }],
  artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',
  appx: {
    displayName: 'X Minecraft Launcher (Beta)',
    applicationId: 'CI010.XMCL',
    identityName: '22961CI010.XMCL',
    backgroundColor: 'transparent',
    publisher: 'CN=DAFB9390-F5BD-4F94-828C-242F8DAA6FDE',
    publisherDisplayName: 'CI010',
    setBuildNumber: true,
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
    certificateFile: undefined as string | undefined,
    icon: 'icons/dark.ico',
    target: [
      {
        target: 'zip',
        arch: [
          'x64',
          'ia32',
        ],
      },
      'appx',
    ],
  },
  linux: {
    executableName: 'xmcl',
    desktop: {
      MimeType: 'x-scheme-handler/xmcl',
      StartupWMClass: 'xmcl',
    },
    category: 'Game',
    icon: 'icons/dark.icns',
    artifactName: 'xmcl-${version}-${arch}.${ext}',
    target: [
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
    ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
} satisfies Configuration
