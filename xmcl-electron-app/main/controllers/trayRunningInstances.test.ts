import { describe, expect, it } from 'vitest'
import { TrayRunningInstances } from './trayRunningInstances'

describe('tray running instance status', () => {
  it('keeps an instance running until its final client/server process exits', () => {
    const running = new TrayRunningInstances()
    running.add(1, '/a')
    running.add(2, '/a')
    running.add(3, '/b')
    running.delete(1)
    expect(running.has('/a')).toBe(true)
    running.delete(2)
    expect(running.has('/a')).toBe(false)
    expect(running.has('/b')).toBe(true)
  })

  it('tolerates duplicate start observations and unknown exits', () => {
    const running = new TrayRunningInstances()
    running.add(1, '/a')
    running.add(1, '/a')
    running.delete(99)
    running.delete(1)
    expect(running.has('/a')).toBe(false)
  })
})
