import { describe, expect, test, vi } from 'vitest'
import { createAgentPassiveEventMessage, drainAgentPassiveEvents, enqueueAgentPassiveEvent, registerAgentPassiveEventConsumer } from './passiveEvents'

describe('Agent passive events', () => {
  test('queues events by instance scope and drains them once', () => {
    enqueueAgentPassiveEvent('instance-a', { type: 'game-start', pid: 1, launchId: 'launch-a', launchPath: 'launches/launch-a', side: 'client', version: 'neoforge-1.21.1', minecraft: '1.21.1' })
    enqueueAgentPassiveEvent('instance-b', { type: 'game-start', pid: 2, launchId: 'launch-b', launchPath: 'launches/launch-b', side: 'server', version: '1.21.1', minecraft: '1.21.1' })

    expect(drainAgentPassiveEvents('instance-a')).toEqual([
      { type: 'game-start', pid: 1, launchId: 'launch-a', launchPath: 'launches/launch-a', side: 'client', version: 'neoforge-1.21.1', minecraft: '1.21.1' },
    ])
    expect(drainAgentPassiveEvents('instance-a')).toEqual([])
    expect(drainAgentPassiveEvents('instance-b')).toHaveLength(1)
  })

  test('delivers events to the active message loop before queuing', () => {
    const received: unknown[] = []
    const unregister = registerAgentPassiveEventConsumer('instance-active', (event) => {
      received.push(event)
      return true
    })
    const exited = { type: 'game-exit' as const, pid: 42, launchId: 'launch-active', launchPath: 'launches/launch-active', side: 'client' as const, code: 1, duration: 1200, crashed: true }

    enqueueAgentPassiveEvent('instance-active', exited)

    expect(received).toEqual([exited])
    expect(drainAgentPassiveEvents('instance-active')).toEqual([])

    unregister()
    const nextExit = { ...exited, pid: 45, launchId: 'launch-next', launchPath: 'launches/launch-next' }
    enqueueAgentPassiveEvent('instance-active', nextExit)
    expect(drainAgentPassiveEvents('instance-active')).toEqual([nextExit])
  })

  test('deduplicates repeated lifecycle broadcasts for the same process', () => {
    const received: unknown[] = []
    const unregister = registerAgentPassiveEventConsumer('instance-duplicate', (event) => {
      received.push(event)
      return true
    })
    const started = { type: 'game-start' as const, pid: 46, launchId: 'launch-duplicate', launchPath: 'launches/launch-duplicate', side: 'client' as const, version: 'neoforge-26.1.2', minecraft: '26.1.2' }
    const exited = { type: 'game-exit' as const, pid: 46, launchId: 'launch-duplicate', launchPath: 'launches/launch-duplicate', side: 'client' as const, code: 0, duration: 1000, crashed: false }

    for (let index = 0; index < 4; index++) enqueueAgentPassiveEvent('instance-duplicate', started)
    for (let index = 0; index < 4; index++) enqueueAgentPassiveEvent('instance-duplicate', exited)

    expect(received).toEqual([started, exited])
    unregister()
  })

  test('accepts a lifecycle identity again after the deduplication window', () => {
    const now = vi.spyOn(Date, 'now')
    const started = { type: 'game-start' as const, pid: 47, launchId: 'launch-reused', launchPath: 'launches/launch-reused', side: 'client' as const, version: 'neoforge-26.1.2', minecraft: '26.1.2' }
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(11_000)

    enqueueAgentPassiveEvent('instance-pid-reuse', started)
    expect(drainAgentPassiveEvents('instance-pid-reuse')).toEqual([started])
    enqueueAgentPassiveEvent('instance-pid-reuse', started)
    expect(drainAgentPassiveEvents('instance-pid-reuse')).toEqual([started])

    now.mockRestore()
  })

  test('delivers events queued while the active message loop was starting', () => {
    const exited = { type: 'game-exit' as const, pid: 43, launchId: 'launch-starting', launchPath: 'launches/launch-starting', side: 'client' as const, code: 1, duration: 800, crashed: true }
    enqueueAgentPassiveEvent('instance-starting', exited)
    const received: unknown[] = []

    const unregister = registerAgentPassiveEventConsumer('instance-starting', (event) => {
      received.push(event)
      return true
    })

    expect(received).toEqual([exited])
    expect(drainAgentPassiveEvents('instance-starting')).toEqual([])
    unregister()
  })

  test('keeps queued events when the registered message loop cannot consume them', () => {
    const exited = { type: 'game-exit' as const, pid: 44, launchId: 'launch-inactive', launchPath: 'launches/launch-inactive', side: 'client' as const, code: 0, duration: 500, crashed: false }
    enqueueAgentPassiveEvent('instance-inactive', exited)

    const unregister = registerAgentPassiveEventConsumer('instance-inactive', () => false)

    expect(drainAgentPassiveEvents('instance-inactive')).toEqual([exited])
    unregister()
  })

  test('formats lightweight game lifecycle context without log content', () => {
    const started = createAgentPassiveEventMessage({
      type: 'game-start',
      pid: 42,
      launchId: 'launch-format',
      launchPath: 'launches/launch-format',
      side: 'client',
      version: 'neoforge-26.1.2.10-beta',
      minecraft: '26.1.2',
    })
    const exited = createAgentPassiveEventMessage({
      type: 'game-exit',
      pid: 42,
      launchId: 'launch-format',
      launchPath: 'launches/launch-format',
      side: 'client',
      code: 1,
      duration: 1200,
      crashed: true,
    })

    expect(started.content).toContain('Game started')
    expect(started.content).toContain('"minecraft":"26.1.2"')
    expect(exited.content).toContain('"code":1')
    expect(exited.content).toContain('"crashed":true')
    expect(exited.content).toContain('launches/launch-format/summary.json')
    expect(exited.content).not.toContain('errorLog')
  })

  test('formats mod diagnosis as passive context', () => {
    const message = createAgentPassiveEventMessage({
      type: 'mod-diagnosis',
      diagnosis: { status: 'issues', incompatibilities: [{ mod: 'sodium', dependency: 'neoforge' }] },
    })

    expect(message.content).toContain('Mod compatibility diagnosis after applying the instance manifest')
    expect(message.content).toContain('"dependency":"neoforge"')
  })
})