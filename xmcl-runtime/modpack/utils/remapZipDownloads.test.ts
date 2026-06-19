import type { InstanceFile } from '@xmcl/instance'
import { describe, expect, it } from 'vitest'
import { remapModpackZipDownloads } from './remapZipDownloads'

const makeFile = (downloads?: string[]): InstanceFile => ({
  path: 'mods/example.jar',
  size: 1,
  hashes: { crc32: '1' },
  downloads,
})

describe('remapModpackZipDownloads', () => {
  it('re-points a stale absolute zip download at the current modpack path', () => {
    const oldPath = '/home/user/Desktop/B.zip'
    const newPath = '/home/user/Desktop/A/B.zip'
    const file = makeFile([
      `zip:///${oldPath}?entry=${encodeURIComponent('mods/example.jar')}`,
      'zip://sha1hash/mods/example.jar',
    ])

    const result = remapModpackZipDownloads(file, newPath)

    expect(result.downloads).toEqual([
      `zip:///${newPath}?entry=${encodeURIComponent('mods/example.jar')}`,
      'zip://sha1hash/mods/example.jar',
    ])
  })

  it('preserves non-ascii (e.g. Chinese) paths and entries', () => {
    const oldPath = '/home/user/桌面/乙.zip'
    const newPath = '/home/user/桌面/甲/乙.zip'
    const entry = 'mods/模组.jar'
    const file = makeFile([`zip:///${oldPath}?entry=${encodeURIComponent(entry)}`])

    const result = remapModpackZipDownloads(file, newPath)

    expect(result.downloads).toEqual([
      `zip:///${newPath}?entry=${encodeURIComponent(entry)}`,
    ])
    // The decoded entry round-trips correctly.
    const url = new URL(result.downloads![0])
    expect(url.searchParams.get('entry')).toBe(entry)
  })

  it('preserves Windows backslash paths', () => {
    const newPath = 'C:\\Users\\user\\Desktop\\甲\\乙.zip'
    const file = makeFile([
      `zip:///C:\\Users\\user\\Desktop\\乙.zip?entry=${encodeURIComponent('mods/example.jar')}`,
    ])

    const result = remapModpackZipDownloads(file, newPath)

    expect(result.downloads![0]).toBe(
      `zip:///${newPath}?entry=${encodeURIComponent('mods/example.jar')}`,
    )
  })

  it('leaves hash-relative zip urls untouched', () => {
    const file = makeFile(['zip://sha1hash/mods/example.jar'])
    const result = remapModpackZipDownloads(file, '/new/path.zip')
    expect(result).toBe(file)
    expect(result.downloads).toEqual(['zip://sha1hash/mods/example.jar'])
  })

  it('leaves http downloads untouched', () => {
    const file = makeFile(['https://example.com/mods/example.jar'])
    const result = remapModpackZipDownloads(file, '/new/path.zip')
    expect(result).toBe(file)
  })

  it('returns the same file reference when there are no downloads', () => {
    const file = makeFile(undefined)
    const result = remapModpackZipDownloads(file, '/new/path.zip')
    expect(result).toBe(file)
  })
})
