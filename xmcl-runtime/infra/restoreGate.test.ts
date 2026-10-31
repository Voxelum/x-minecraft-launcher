import { afterEach, describe, expect, test, vi } from 'vitest'
import { RestoreGate } from './restoreGate'
const signal = () => {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}
afterEach(() => vi.useRealTimers())
describe('restore persistence barrier', () => {
  test('drains delayed and in-flight writes, blocks direct state/config and service calls', async () => {
    const gate = new RestoreGate()
    const io = signal()
    const write = vi.fn(() => io.promise)
    const writer = gate.writer(write, 500)
    const state = { value: 0, config(n: number) { this.value = n; writer.schedule() } }
    gate.guardState(state)
    state.config(1)
    let entered = false
    const entering = gate.enter(() => {}).then(() => { entered = true })
    await Promise.resolve()
    await Promise.resolve()
    expect(write).toHaveBeenCalledOnce()
    expect(entered).toBe(false)
    expect(() => state.config(2)).toThrow('maintenance')
    expect(() => gate.run(() => {})).toThrow('maintenance')
    io.resolve()
    await entering
    gate.publish(() => state.config(3))
    await writer.flush()
    expect(write).toHaveBeenCalledOnce()
    expect(state.value).toBe(3)
    gate.publish(() => state.config(1))
    gate.release(false)
    state.config(4)
    await writer.flush()
    expect(write).toHaveBeenCalledTimes(2)
  })
  test('direct service install/launch calls reject as promises and drain admitted work', async () => {
    const gate = new RestoreGate()
    const operation = signal()
    const service = { install: vi.fn(async () => { await operation.promise }), launch: vi.fn(async () => {}) }
    gate.guardMethods(service, ['install', 'launch'])
    const install = service.install()
    let entered = false
    const entering = gate.enter(() => {}).then(() => { entered = true })
    await expect(service.install()).rejects.toThrow('maintenance')
    await expect(service.launch()).rejects.toThrow('maintenance')
    expect(entered).toBe(false)
    operation.resolve()
    await Promise.all([install, entering])
    gate.release(false)
    await expect(service.launch()).resolves.toBeUndefined()
  })
  test('awaits previously admitted operations and rejects a process started during drain', async () => {
    const gate = new RestoreGate()
    const operation = signal()
    let running = false
    const work = gate.run(async () => { await operation.promise; running = true })
    const entering = gate.enter(() => { if (running) throw new Error('running instance') })
    operation.resolve()
    await expect(entering).rejects.toThrow('running instance')
    await work
    expect(() => gate.run(() => {})).not.toThrow()
  })
  test('retains debounced I/O failures instead of claiming drain success', async () => {
    vi.useFakeTimers()
    const gate = new RestoreGate()
    const writer = gate.writer(async () => { throw new Error('disk locked') }, 500)
    writer.schedule()
    await vi.advanceTimersByTimeAsync(500)
    await expect(gate.enter(() => {})).rejects.toThrow('disk locked')
  })
  test('serializes overlapping saves and awaits all writers even if one fails', async () => {
    const gate = new RestoreGate()
    const io = signal()
    let active = 0
    let max = 0
    const writer = gate.writer(async () => { active++; max = Math.max(max, active); await io.promise; active-- })
    writer.schedule()
    const flush1 = writer.flush()
    await Promise.resolve()
    writer.schedule()
    const flush2 = writer.flush()
    const failure = gate.writer(async () => { throw new Error('failure') })
    failure.schedule()
    let settled = false
    const entering = gate.enter(() => {}).catch(e => { settled = true; throw e })
    const result = expect(entering).rejects.toThrow('failure')
    await Promise.resolve()
    expect(settled).toBe(false)
    io.resolve()
    await Promise.all([flush1, flush2, result])
    expect(max).toBe(1)
  })
  test('recovery-required release remains fail closed and disposal cannot overwrite evidence', async () => {
    const gate = new RestoreGate()
    const write = vi.fn(async () => {})
    const writer = gate.writer(write)
    await gate.enter(() => {})
    gate.release(true)
    expect(() => writer.schedule()).toThrow('maintenance')
    expect(() => gate.run(() => {})).toThrow('maintenance')
    await writer.flush()
    expect(write).not.toHaveBeenCalled()
    await expect(gate.enter(() => {})).rejects.toThrow('maintenance')
  })
  test('detached continuations cannot retain an expired operation capability', async () => {
    const gate = new RestoreGate()
    const later = signal()
    let detached!: Promise<void>
    gate.run(() => { detached = later.promise.then(() => gate.assertWritable()) })
    await gate.enter(() => {})
    const rejected = expect(detached).rejects.toThrow('maintenance')
    later.resolve()
    await rejected
  })
})
