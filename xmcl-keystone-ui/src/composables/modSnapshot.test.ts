import { describe, expect, test, vi } from 'vitest'
import { waitForModSnapshot } from './modSnapshot'

describe('mod snapshot settling', () => {
  test('waits for validation and the throttled visible snapshot to catch up', async () => {
    const source = ['new.jar']
    let visible = ['old.jar']
    let validating = true
    const wait = vi.fn(async () => {
      validating = false
      visible = source
    })

    await expect(waitForModSnapshot(
      () => ({ source, visible, validating }),
      mods => mods.includes('new.jar'),
      { attempts: 2, wait },
    )).resolves.toBe(true)
    expect(wait).toHaveBeenCalledOnce()
  })

  test('returns false when the expected file state never appears', async () => {
    const mods = ['old.jar']
    await expect(waitForModSnapshot(
      () => ({ source: mods, visible: mods, validating: false }),
      visible => visible.includes('new.jar'),
      { attempts: 2, wait: async () => {} },
    )).resolves.toBe(false)
  })
})