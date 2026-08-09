import { describe, expect, test } from 'vitest'
import { getLatestNeoforge, sortNeoForgeVersions } from './neoForgeVersion'

describe('NeoForge version ordering', () => {
  test('sorts modern four-part versions from newest to oldest', () => {
    const versions = ['26.1.2.9-beta', '26.1.2.76', '26.1.2.10-beta', '26.1.2.0-beta']

    expect(sortNeoForgeVersions(versions)).toEqual([
      '26.1.2.76',
      '26.1.2.10-beta',
      '26.1.2.9-beta',
      '26.1.2.0-beta',
    ])
    expect(versions).toEqual(['26.1.2.9-beta', '26.1.2.76', '26.1.2.10-beta', '26.1.2.0-beta'])
  })

  test('prefers a release over its prerelease and returns the newest version', () => {
    expect(sortNeoForgeVersions(['21.1.200-beta', '21.1.199', '21.1.200'])).toEqual([
      '21.1.200',
      '21.1.200-beta',
      '21.1.199',
    ])
    expect(getLatestNeoforge(['20.4.80', '20.4.109', '20.4.95'])).toBe('20.4.109')
  })
})