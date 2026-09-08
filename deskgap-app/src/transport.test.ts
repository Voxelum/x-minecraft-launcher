import { describe, expect, it } from 'vitest'
import { TransportFrameDecoder } from './framing'
import { decodeBrowserValue, encodeBrowserFrame } from './transport'

describe('encodeBrowserFrame', () => {
  it('encodes tagged and Unicode values in one valid frame', () => {
    const frame = encodeBrowserFrame({ text: '你好 XMCL', count: 42n, missing: undefined })
    const decoder = new TransportFrameDecoder()
    const frames = decoder.push(frame)

    expect(frames).toHaveLength(1)
    expect(decodeBrowserValue(JSON.parse(new TextDecoder().decode(frames[0])), value => value)).toEqual({
      text: '你好 XMCL',
      count: 42n,
      missing: undefined,
    })
  })
})