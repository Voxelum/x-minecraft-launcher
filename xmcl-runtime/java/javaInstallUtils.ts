import { resolve } from 'path'

export interface JavaRuntime {
  name: string
  vendor: string
  runtimeOS: string
  downloadType: 'manifest' | 'archive' | string
  url: string
  packageType?: string
  releaseTime?: string
  version?: {
    major?: number
    minor?: number
    security?: number
    build?: number
    name?: string
  }
  checksum?: { type: string; hash: string }
}

interface JavaRuntimePlatform {
  os: string
  arch: string
}

export function getSupportedJavaRuntimes(
  runtimes: JavaRuntime[],
  vendor: string,
  platform: JavaRuntimePlatform,
) {
  const runtimeOS = platform.os === 'osx' ? 'mac-os' : platform.os

  return runtimes.filter(
    (runtime) =>
      runtime.vendor === vendor &&
      runtime.runtimeOS === `${runtimeOS}-${platform.arch}` &&
      (runtime.downloadType === 'manifest' || runtime.downloadType === 'archive') &&
      typeof runtime.url === 'string' &&
      runtime.url.startsWith('https://') &&
      typeof runtime.checksum?.hash === 'string' &&
      !!runtime.checksum.hash &&
      typeof runtime.checksum.type === 'string' &&
      ['sha1', 'sha256'].includes(runtime.checksum.type.toLowerCase().replace('-', '')),
  )
}

export function getJavaRuntimeDestination(root: string, name: string) {
  if (
    typeof name !== 'string' ||
    !/^[A-Za-z0-9._+-]+$/.test(name) ||
    name === '.' ||
    name === '..'
  ) {
    throw new Error(`Invalid Java runtime name: ${name}`)
  }
  return resolve(root, name)
}
