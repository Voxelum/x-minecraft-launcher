import { describe, expect, it, vi } from 'vitest'
import { resolveLaunchId } from './instanceLaunch'

describe('resolveLaunchId', () => {
  it('uses the matching start event without querying the process', async () => {
    const getGameProcess = vi.fn()

    await expect(resolveLaunchId(42, 'event-launch', getGameProcess)).resolves.toBe('event-launch')
    expect(getGameProcess).not.toHaveBeenCalled()
  })

  it('falls back to the main process record when the start event arrives after the RPC response', async () => {
    const getGameProcess = vi.fn().mockResolvedValue({ launchId: 'recorded-launch' })

    await expect(resolveLaunchId(42, undefined, getGameProcess)).resolves.toBe('recorded-launch')
    expect(getGameProcess).toHaveBeenCalledWith(42)
  })
})