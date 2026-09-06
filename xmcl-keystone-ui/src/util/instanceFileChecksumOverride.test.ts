import { describe, expect, it } from 'vitest'
import { instanceFileChecksumOverride } from './instanceFileChecksumOverride'

describe('explicit checksum override', () => {
  it.each(['sha1', 'sha256', 'sha512', 'crc32'])('keeps the actual %s algorithm instead of relabeling it SHA1', (algorithm) => {
    const file = { path: 'mods/a.jar', hashes: { [algorithm]: '123' }, downloads: ['https://example.invalid/a.jar'] }
    const accepted = instanceFileChecksumOverride({ file, expect: '123', actual: '456' })
    expect(accepted.hashes).toEqual({ [algorithm]: '456' })
    expect(accepted.downloads).toBe(file.downloads)
    expect(file.hashes[algorithm]).toBe('123')
  })
})
