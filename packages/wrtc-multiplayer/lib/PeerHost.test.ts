import { describe, expect, it } from 'vitest'
import { getContentDisposition } from './PeerHost'

describe('getContentDisposition', () => {
  it('encodes non-ASCII filenames as an RFC 8187 header value', () => {
    const value = getContentDisposition("易'()*世界.zip")

    expect(value).toBe("attachment; filename*=UTF-8''%E6%98%93%27%28%29%2A%E4%B8%96%E7%95%8C.zip")
    expect([...value].every((character) => character.charCodeAt(0) <= 0x7F)).toBe(true)
  })
})
