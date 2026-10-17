import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { readdirIfPresent } from '../util/fs'
import { getAdoptiumJavaPaths, getJavaPathsLinux, isFlatpakSandbox } from './javaPaths'

vi.mock('../util/fs', () => ({ readdirIfPresent: vi.fn() }))
vi.mock('fs-extra', () => ({ readdir: vi.fn() }))

const mockedReaddir = vi.mocked(readdir)

function mockDirs(map: Record<string, string[]>) {
  mockedReaddir.mockImplementation((async (root: string) => map[root] ?? []) as any)
}

describe('getAdoptiumJavaPaths', () => {
  beforeEach(() => {
    vi.mocked(readdirIfPresent).mockReset().mockResolvedValue([])
  })

  it('finds Temurin 17 under the default Eclipse Adoptium installation directory', async () => {
    vi.mocked(readdirIfPresent).mockImplementation(async root =>
      root === 'C:\\Program Files\\Eclipse Adoptium' ? ['jdk-17.0.20.101-hotspot'] : [])

    expect(await getAdoptiumJavaPaths({})).toEqual([
      'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe',
    ])
    expect(readdirIfPresent).toHaveBeenCalledTimes(2)
  })

  it('checks native and x86 Program Files on non-default drives without duplicate scans', async () => {
    vi.mocked(readdirIfPresent).mockResolvedValue(['jdk-17', 'jdk-25'])
    expect(await getAdoptiumJavaPaths({
      ProgramW6432: 'D:\\Program Files',
      ProgramFiles: 'D:\\Program Files (x86)',
      'ProgramFiles(x86)': 'D:\\Program Files (x86)',
    })).toEqual([
      'D:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe',
      'D:\\Program Files\\Eclipse Adoptium\\jdk-25\\bin\\java.exe',
      'D:\\Program Files (x86)\\Eclipse Adoptium\\jdk-17\\bin\\java.exe',
      'D:\\Program Files (x86)\\Eclipse Adoptium\\jdk-25\\bin\\java.exe',
    ])
    expect(readdirIfPresent).toHaveBeenCalledTimes(2)
  })

  it('returns no candidates when Adoptium is not installed', async () => {
    expect(await getAdoptiumJavaPaths({})).toEqual([])
  })

  it('does not hide unexpected directory access failures', async () => {
    const error = Object.assign(new Error('Access denied'), { code: 'EACCES' })
    vi.mocked(readdirIfPresent).mockRejectedValue(error)
    await expect(getAdoptiumJavaPaths({})).rejects.toBe(error)
  })
})

describe('isFlatpakSandbox', () => {
  it('detects the Flatpak marker env var', () => {
    expect(isFlatpakSandbox({ FLATPAK_ID: 'app.xmcl.voxelum' })).toBe(true)
    expect(isFlatpakSandbox({ FLATPAK_ID: '' })).toBe(false)
    expect(isFlatpakSandbox({})).toBe(false)
  })
})

describe('getJavaPathsLinux', () => {
  const sandboxJvm = join('/usr/lib/jvm', 'java-17-openjdk', 'bin', 'java')
  const hostJvm = join('/var/run/host/usr/lib/jvm', 'java-26-openjdk', 'bin', 'java')
  const hostLib64Jvm = join('/var/run/host/usr/lib64/jvm', 'jdk-21-openjdk', 'bin', 'java')

  beforeEach(() => {
    mockedReaddir.mockReset()
    mockDirs({})
  })

  it('only scans the sandbox jvm root outside Flatpak', async () => {
    mockDirs({
      '/usr/lib/jvm': ['java-17-openjdk'],
      '/var/run/host/usr/lib/jvm': ['java-26-openjdk'],
    })

    expect(await getJavaPathsLinux({})).toEqual([sandboxJvm])
    expect(mockedReaddir).toHaveBeenCalledTimes(1)
  })

  it('also scans the host jvm roots when running inside Flatpak', async () => {
    mockDirs({
      '/usr/lib/jvm': ['java-17-openjdk'],
      '/var/run/host/usr/lib/jvm': ['java-26-openjdk'],
      '/var/run/host/usr/lib64/jvm': ['jdk-21-openjdk'],
    })

    expect(await getJavaPathsLinux({ FLATPAK_ID: 'app.xmcl.voxelum' })).toEqual([
      sandboxJvm,
      hostJvm,
      hostLib64Jvm,
    ])
    expect(mockedReaddir).toHaveBeenCalledWith('/var/run/host/usr/lib/jvm')
    expect(mockedReaddir).toHaveBeenCalledWith('/var/run/host/usr/lib64/jvm')
    expect(mockedReaddir).toHaveBeenCalledWith('/var/run/host/usr/java')
  })

  it('keeps the sandbox jvm root when the host roots are not accessible', async () => {
    mockedReaddir.mockImplementation((async (root: string) => {
      if (root === '/usr/lib/jvm') return ['java-17-openjdk']
      throw Object.assign(new Error('Permission denied'), { code: 'EACCES' })
    }) as any)

    expect(await getJavaPathsLinux({ FLATPAK_ID: 'app.xmcl.voxelum' })).toEqual([sandboxJvm])
  })

  it('returns nothing when no jvm root exists', async () => {
    expect(await getJavaPathsLinux({ FLATPAK_ID: 'app.xmcl.voxelum' })).toEqual([])
  })
})
