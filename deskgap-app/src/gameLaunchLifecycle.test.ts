import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { bindGameLaunchLifecycle, type GameLaunchLifecycleService } from './gameLaunchLifecycle'

class FakeLaunchService extends EventEmitter {
  processes: unknown[] = []

  getProcesses() {
    return this.processes
  }
}

function setup() {
  const service = new FakeLaunchService()
  const controller = {
    closeMonitorWindow: vi.fn(),
    createMonitorWindow: vi.fn(async () => {}),
    handleMinecraftExit: vi.fn(),
    handleMinecraftWindowReady: vi.fn(),
    setGameRunning: vi.fn(),
  }
  const host = {
    moveGameWindow: vi.fn(async () => {}),
    warn: vi.fn(),
  }
  bindGameLaunchLifecycle(service as GameLaunchLifecycleService, controller, host)
  return { service, controller, host }
}

describe('bindGameLaunchLifecycle', () => {
  it('moves a fullscreen game and applies launcher visibility when its window is ready', () => {
    const { service, controller, host } = setup()
    service.emit('minecraft-window-ready', {
      hideLauncher: true,
      pid: 42,
      resolution: { fullscreen: true, monitor: 'secondary' },
    })
    expect(host.moveGameWindow).toHaveBeenCalledWith(42, 'secondary')
    expect(controller.handleMinecraftWindowReady).toHaveBeenCalledWith(true)
  })

  it('parks the launcher and opens the monitor when logging is requested', () => {
    const { service, controller } = setup()
    service.processes = [{}]
    service.emit('minecraft-start', { showLog: true })
    expect(controller.setGameRunning).toHaveBeenCalledWith(true)
    expect(controller.createMonitorWindow).toHaveBeenCalledOnce()
  })

  it('restores the launcher and closes the monitor after the last clean exit', () => {
    const { service, controller } = setup()
    const status = { code: 0 }
    service.emit('minecraft-exit', status)
    expect(controller.setGameRunning).toHaveBeenCalledWith(false)
    expect(controller.handleMinecraftExit).toHaveBeenCalledWith(status)
    expect(controller.closeMonitorWindow).toHaveBeenCalledOnce()
  })

  it('keeps the monitor open for crashes and concurrent games', () => {
    const { service, controller } = setup()
    service.emit('minecraft-exit', { code: 1, crashReport: 'crash.txt' })
    service.processes = [{}]
    service.emit('minecraft-exit', { code: 0 })
    expect(controller.closeMonitorWindow).not.toHaveBeenCalled()
  })
})