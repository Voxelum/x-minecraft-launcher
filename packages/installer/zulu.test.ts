import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs/promises'
import { selectZuluJRE, ZuluJRE, installZuluJava } from './zulu'

// Sample test data
const sampleZuluJREs: ZuluJRE[] = [
  {
    features: ['javafx'],
    architecture: 'x64',
    os: 'win32',
    sha256: 'abc123',
    size: 76012136,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-fx-jre17.0.1-win_x64.zip',
  },
  {
    features: [],
    architecture: 'x64',
    os: 'win32',
    sha256: 'def456',
    size: 42985959,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-win_x64.zip',
  },
  {
    features: ['musl'],
    architecture: 'x64',
    os: 'linux',
    sha256: 'ghi789',
    size: 47037733,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-linux_musl_x64.tar.gz',
  },
  {
    features: [],
    architecture: 'x64',
    os: 'linux',
    sha256: 'jkl012',
    size: 47037733,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-linux_x64.tar.gz',
  },
  {
    features: ['javafx'],
    architecture: 'arm64',
    os: 'darwin',
    sha256: 'mno345',
    size: 43663815,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-fx-jre17.0.1-macosx_aarch64.tar.gz',
  },
  {
    features: [],
    architecture: 'arm64',
    os: 'darwin',
    sha256: 'pqr678',
    size: 43663815,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-macosx_aarch64.tar.gz',
  },
  {
    features: [],
    architecture: 'ia32',
    os: 'win32',
    sha256: 'stu901',
    size: 40179413,
    url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-win_i686.zip',
  },
]

describe('ZuluInstaller', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'zulu-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  describe('#selectZuluJRE', () => {
    test('should select JRE for Windows x64 with javafx preference', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'x64')
      expect(selected).toBeDefined()
      expect(selected?.os).toBe('win32')
      expect(selected?.architecture).toBe('x64')
      expect(selected?.features).toContain('javafx')
      expect(selected?.url).toContain('fx-jre')
    })

    test('should select JRE for Linux x64 with musl preference', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'linux', 'x64')
      expect(selected).toBeDefined()
      expect(selected?.os).toBe('linux')
      expect(selected?.architecture).toBe('x64')
      expect(selected?.features).toContain('musl')
      expect(selected?.url).toContain('musl')
    })

    test('should select JRE for macOS ARM64 with javafx preference', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'darwin', 'arm64')
      expect(selected).toBeDefined()
      expect(selected?.os).toBe('darwin')
      expect(selected?.architecture).toBe('arm64')
      expect(selected?.features).toContain('javafx')
    })

    test('should fallback to basic JRE if no preferred features available', () => {
      const basicJREs = sampleZuluJREs.filter((jre) => jre.features.length === 0)
      const selected = selectZuluJRE(basicJREs, 'win32', 'x64')
      expect(selected).toBeDefined()
      expect(selected?.os).toBe('win32')
      expect(selected?.architecture).toBe('x64')
      expect(selected?.features).toEqual([])
    })

    test('should return undefined for unsupported platform/architecture', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'freebsd', 'arm64')
      expect(selected).toBeUndefined()
    })

    test('should return undefined for unsupported architecture', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'ppc64')
      expect(selected).toBeUndefined()
    })

    test('should handle ia32/x86 architecture normalization', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'x86')
      expect(selected).toBeDefined()
      expect(selected?.architecture).toBe('ia32')
    })

    test('should use current platform and architecture by default', () => {
      const originalPlatform = process.platform
      const originalArch = process.arch

      // Mock process.platform and process.arch
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })

      try {
        const selected = selectZuluJRE(sampleZuluJREs)
        expect(selected).toBeDefined()
        expect(selected?.os).toBe('win32')
        expect(selected?.architecture).toBe('x64')
      } finally {
        // Restore original values
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
        Object.defineProperty(process, 'arch', { value: originalArch, configurable: true })
      }
    })
  })

  describe('#installZuluJava', () => {
    test('should throw error for unsupported archive formats', async () => {
      const jre: ZuluJRE = {
        features: [],
        architecture: 'x64',
        os: 'linux',
        sha256: 'abc123def456',
        size: 47037733,
        url: 'https://static.azul.com/zulu/bin/zulu17.30.15-ca-jre17.0.1-linux_x64.rar',
      }

      await expect(installZuluJava(jre, { destination: tempDir })).rejects.toThrow(
        'Unsupported archive format',
      )
    })
  })

  describe('Archive format detection', () => {
    test('should detect zip format from Windows URLs', () => {
      const windowsJre = sampleZuluJREs.find((jre) => jre.os === 'win32')
      expect(windowsJre?.url).toMatch(/\.zip$/)
    })

    test('should detect tar.gz format from Linux URLs', () => {
      const linuxJre = sampleZuluJREs.find((jre) => jre.os === 'linux')
      expect(linuxJre?.url).toMatch(/\.tar\.gz$/)
    })

    test('should detect tar.gz format from macOS URLs', () => {
      const macosJre = sampleZuluJREs.find((jre) => jre.os === 'darwin')
      expect(macosJre?.url).toMatch(/\.tar\.gz$/)
    })
  })

  describe('JRE selection preferences', () => {
    test('should prefer musl builds on Linux', () => {
      const linuxJREs = sampleZuluJREs.filter(
        (jre) => jre.os === 'linux' && jre.architecture === 'x64',
      )
      const selected = selectZuluJRE(linuxJREs, 'linux', 'x64')

      expect(selected?.features).toContain('musl')
    })

    test('should prefer javafx builds when musl is not available', () => {
      const nonMuslJREs = sampleZuluJREs.filter((jre) => !jre.features.includes('musl'))
      const selected = selectZuluJRE(nonMuslJREs, 'win32', 'x64')

      expect(selected?.features).toContain('javafx')
    })

    test('should select any available JRE when no preferred features exist', () => {
      const basicJREs = sampleZuluJREs.filter(
        (jre) => jre.features.length === 0 && jre.os === 'win32' && jre.architecture === 'x64',
      )
      const selected = selectZuluJRE(basicJREs, 'win32', 'x64')

      expect(selected).toBeDefined()
      expect(selected?.features).toEqual([])
    })
  })

  describe('Platform normalization', () => {
    test('should normalize darwin platform', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'darwin', 'arm64')
      expect(selected?.os).toBe('darwin')
    })

    test('should normalize win32 platform', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'x64')
      expect(selected?.os).toBe('win32')
    })

    test('should normalize linux platform', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'linux', 'x64')
      expect(selected?.os).toBe('linux')
    })
  })

  describe('Architecture normalization', () => {
    test('should normalize x64 architecture', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'x64')
      expect(selected?.architecture).toBe('x64')
    })

    test('should normalize arm64 architecture', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'darwin', 'arm64')
      expect(selected?.architecture).toBe('arm64')
    })

    test('should normalize ia32 from x86', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'x86')
      expect(selected?.architecture).toBe('ia32')
    })

    test('should normalize ia32 from ia32', () => {
      const selected = selectZuluJRE(sampleZuluJREs, 'win32', 'ia32')
      expect(selected?.architecture).toBe('ia32')
    })
  })
})
