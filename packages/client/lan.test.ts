import { expect, test, vi } from 'vitest'
import { MinecraftLanDiscover } from './lan'

test('reports a multicast membership failure through bind', async () => {
  const discover = new MinecraftLanDiscover('udp4')
  const error = Object.assign(new Error('No multicast interface'), { code: 'EADDRNOTAVAIL' })
  vi.spyOn(discover.socket, 'addMembership').mockImplementation(() => { throw error })

  try {
    await expect(discover.bind()).rejects.toBe(error)
    expect(discover.isReady).toBe(false)
  } finally {
    await discover.destroy()
  }
})
