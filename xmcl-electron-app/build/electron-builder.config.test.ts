import { describe, expect, it } from 'vitest'
import { config } from './electron-builder.config'

describe('macOS packaging', () => {
  it('declares local network access for XMCL and its Minecraft subprocesses', () => {
    expect(config.mac.extendInfo.NSLocalNetworkUsageDescription).toBe(
      'XMCL and Minecraft need access to your local network to discover and connect to LAN games and servers.',
    )
  })
})
