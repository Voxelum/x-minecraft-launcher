import { resolve } from 'path'
import { describe, expect, test } from 'vitest'
import {
  getJavaRuntimeDestination,
  getJavaRuntimeVersionFromName,
  getSupportedJavaRuntimes,
  type JavaRuntime,
} from './javaInstallUtils'

const runtime = (overrides: Partial<JavaRuntime> = {}): JavaRuntime => ({
  name: 'temurin-jre21',
  vendor: 'eclipse',
  runtimeOS: 'linux-x64',
  downloadType: 'archive',
  url: 'https://example.com/java.tar.gz',
  checksum: { type: 'sha256', hash: 'abc123' },
  ...overrides,
})

describe('Java install metadata helpers', () => {
  test('only returns runtimes matching vendor, platform, type, URL, and checksum', () => {
    const compatible = runtime()
    const candidates = [
      compatible,
      runtime({ vendor: 'azul' }),
      runtime({ runtimeOS: 'windows-x64' }),
      runtime({ downloadType: 'installer' }),
      runtime({ url: 'http://example.com/java.tar.gz' }),
      runtime({ checksum: { type: 'md5', hash: 'abc123' } }),
    ]

    expect(getSupportedJavaRuntimes(candidates, 'eclipse', { os: 'linux', arch: 'x64' })).toEqual([
      compatible,
    ])
  })

  test('matches Prism macOS runtime identifiers', () => {
    const macRuntime = runtime({ runtimeOS: 'mac-os-arm64' })

    expect(getSupportedJavaRuntimes([macRuntime], 'eclipse', { os: 'osx', arch: 'arm64' })).toEqual(
      [macRuntime],
    )
  })

  test('resolves a runtime name directly under the Java root', () => {
    expect(getJavaRuntimeDestination('/data/jre', 'temurin-jre21')).toBe(
      resolve('/data/jre', 'temurin-jre21'),
    )
  })

  test.each([
    ['eclipse_temurin_jre17.0.21+2', '17.0.21.2'],
    ['eclipse_temurin_jre17.0.21+9', '17.0.21.9'],
    ['eclipse_temurin_jre8.0.512+0', '8.0.512'],
    ['java-runtime-delta', undefined],
  ])('reads the Java version from runtime directory %s', (name, expected) => {
    expect(getJavaRuntimeVersionFromName(name)).toBe(expected)
  })

  test.each(['../outside', 'vendor/runtime', 'vendor\\runtime', '.', '..', 'C:outside'])(
    'rejects unsafe runtime directory names: %s',
    (name) => {
      expect(() => getJavaRuntimeDestination('/data/jre', name)).toThrow(
        'Invalid Java runtime name',
      )
    },
  )
})
