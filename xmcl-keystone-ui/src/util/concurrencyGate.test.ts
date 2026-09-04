import { describe, expect, test, vi } from 'vitest'
import { createConcurrencyGate } from './concurrencyGate'

describe('createConcurrencyGate', () => {
  test('limits concurrent work', async () => {
    const gate = createConcurrencyGate(2)
    const first = await gate.acquire()
    const second = await gate.acquire()
    const third = gate.acquire()
    const thirdResolved = vi.fn()
    void third.then(thirdResolved)

    await Promise.resolve()
    expect(thirdResolved).not.toHaveBeenCalled()

    first!()
    const thirdRelease = await third
    expect(thirdRelease).toEqual(expect.any(Function))

    second!()
    thirdRelease!()
  })

  test('clears queued work without cancelling active work', async () => {
    const gate = createConcurrencyGate(1)
    const activeRelease = await gate.acquire()
    const cancelled = gate.acquire()

    gate.clear()

    await expect(cancelled).resolves.toBeUndefined()

    const next = gate.acquire()
    activeRelease!()
    await expect(next).resolves.toEqual(expect.any(Function))
  })

  test('rejects invalid limits', () => {
    expect(() => createConcurrencyGate(0)).toThrow(RangeError)
  })
})
