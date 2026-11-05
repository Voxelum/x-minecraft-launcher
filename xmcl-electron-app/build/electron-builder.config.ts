/* eslint-disable no-template-curly-in-string */
import { config as dotenv } from 'dotenv'
import type { Configuration } from 'electron-builder'
import { resolve } from 'path'
import { LAUNCHER_APP_ID, LAUNCHER_DISPLAY_NAME, LAUNCHER_NAME, LAUNCHER_PROTOCOL } from '../../xmcl-runtime/constant'

dotenv()

const linuxPackageScripts = {
  afterInstall: 'build/linux/after-install.tpl',
  afterRemove: 'build/linux/after-remove.tpl',
  appArmorProfile: 'build/linux/apparmor-profile.tpl',
  fpm: [`--after-upgrade=${resolve(__dirname, 'linux', 'after-install.tpl')}`],
}

export const config = {
  productName: LAUNCHER_DISPLAY_NAME,
  appId: LAUNCHER_APP_ID,
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  protocols: {
    name: LAUNCHER_DISPLAY_NAME,
    schemes: [LAUNCHER_PROTOCOL],
  },
  // Phase 5 must supply Vardrynn-owned signed release hosting explicitly.
  publish: null,
  files: [{
    from: 'dist',
    to: '.',
    filter: ['**/*.js', '**/*.ico', '**/*.png', '**/*.webp', '**/*.svg', '*.node', '*.dll', '**/*.html', '**/*.css', '**/*.woff2', '**/*.wasm'],
  }, {
    from: '.',
    to: '.',
    filter: 'package.json',
  }],
  extraResources: [{
    from: '../LICENSE',
    to: 'LICENSE.XMCL',
  }, {
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }],
  artifactName: 'vardrynn-${version}-${platform}-${arch}.${ext}',
  appx: {
    displayName: LAUNCHER_DISPLAY_NAME,
    applicationId: 'Vardrynn',
    identityName: 'Vardrynn.Launcher',
    backgroundColor: 'transparent',
    publisher: process.env.VARDRYNN_APPX_PUBLISHER,
    publisherDisplayName: LAUNCHER_DISPLAY_NAME,
    setBuildNumber: true,
  },
  dmg: {
    artifactName: 'vardrynn-${version}-${arch}.${ext}',
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
    icon: 'icons/vardrynn.icns',
    darkModeSupport: true,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    extendInfo: {
      NSLocalNetworkUsageDescription: 'Vardrynn and Minecraft need access to your local network to discover and connect to LAN games and servers.',
      NSMicrophoneUsageDescription: 'A Minecraft mod wants to access your microphone.',
      NSCameraUsageDescription: 'Please give us access to your camera',
      'com.apple.security.device.audio-input': true,
      'com.apple.security.device.camera': true,
    },
  },
  win: {
    executableName: LAUNCHER_NAME,
    signtoolOptions: {
      certificateFile: undefined as string | undefined,
      publisherName: process.env.VARDRYNN_PUBLISHER_NAME,
    },
    icon: 'icons/vardrynn.ico',
    electronLanguages: ['en-US'],
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
    maintainer: 'Vardrynn contributors',
    executableName: LAUNCHER_NAME,
    electronLanguages: ['en-US'],
    desktop: {
      entry: {
        MimeType: `x-scheme-handler/${LAUNCHER_PROTOCOL}`,
        StartupWMClass: LAUNCHER_DISPLAY_NAME,
      },
    },
    category: 'Game',
    icon: 'icons/linux',
    artifactName: 'vardrynn-${version}-${arch}.${ext}',
    target: [
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
      { target: 'pacman', arch: ['x64', 'arm64'] },
    ],
  },
  deb: linuxPackageScripts,
  rpm: linuxPackageScripts,
  pacman: linuxPackageScripts,
  snap: {
    publish: null,
  },
} satisfies Configuration
