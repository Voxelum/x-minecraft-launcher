import { describe, it, expect } from 'vitest'
import { join } from 'path'
import {
  MEDIA_URL_PREFIX,
  getMediaIconPath,
  resolveInstanceIcon,
  serializeInstanceIcon,
  toMediaIconUrl,
} from './instanceIcon'

describe('instanceIcon', () => {
  const instancePath = join('/games', 'my-instance')

  describe('getMediaIconPath', () => {
    it('extracts the path from a media url', () => {
      const p = join(instancePath, 'icon.png')
      expect(getMediaIconPath(MEDIA_URL_PREFIX + p)).toBe(p)
    })
    it('returns undefined for non media urls', () => {
      expect(getMediaIconPath('http://launcher/image/abc')).toBeUndefined()
      expect(getMediaIconPath('https://example.com/a.png')).toBeUndefined()
      expect(getMediaIconPath('icon.png')).toBeUndefined()
    })
  })

  describe('resolveInstanceIcon', () => {
    it('resolves a relative reference into an absolute media url', () => {
      expect(resolveInstanceIcon('icon.png', instancePath)).toBe(
        toMediaIconUrl(join(instancePath, 'icon.png')),
      )
    })
    it('keeps external and global urls untouched', () => {
      expect(resolveInstanceIcon('http://launcher/image/abc', instancePath)).toBe('http://launcher/image/abc')
      expect(resolveInstanceIcon('https://example.com/a.png', instancePath)).toBe('https://example.com/a.png')
      expect(resolveInstanceIcon('data:image/png;base64,AAA', instancePath)).toBe('data:image/png;base64,AAA')
    })
    it('returns empty string for empty input', () => {
      expect(resolveInstanceIcon('', instancePath)).toBe('')
      expect(resolveInstanceIcon(undefined, instancePath)).toBe('')
    })
  })

  describe('serializeInstanceIcon', () => {
    it('rewrites a media url inside the folder into a relative path', () => {
      const url = toMediaIconUrl(join(instancePath, 'icon.png'))
      expect(serializeInstanceIcon(url, instancePath)).toBe('icon.png')
    })
    it('keeps a media url pointing outside the folder absolute', () => {
      const url = toMediaIconUrl(join('/somewhere', 'else', 'icon.png'))
      expect(serializeInstanceIcon(url, instancePath)).toBe(url)
    })
    it('keeps external and global urls untouched', () => {
      expect(serializeInstanceIcon('http://launcher/image/abc', instancePath)).toBe('http://launcher/image/abc')
      expect(serializeInstanceIcon('https://example.com/a.png', instancePath)).toBe('https://example.com/a.png')
    })
    it('returns empty string for empty input', () => {
      expect(serializeInstanceIcon('', instancePath)).toBe('')
      expect(serializeInstanceIcon(undefined, instancePath)).toBe('')
    })
  })

  it('round-trips a folder icon through serialize and resolve', () => {
    const url = toMediaIconUrl(join(instancePath, 'icon.png'))
    const persisted = serializeInstanceIcon(url, instancePath)
    expect(resolveInstanceIcon(persisted, instancePath)).toBe(url)
  })
})
