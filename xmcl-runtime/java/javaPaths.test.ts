import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirIfPresent } from '../util/fs'
import { getAdoptiumJavaPaths } from './javaPaths'

vi.mock('../util/fs', () => ({ readdirIfPresent: vi.fn() }))

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
