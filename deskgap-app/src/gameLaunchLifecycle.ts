interface WindowReadyEvent {
  hideLauncher?: boolean
  pid: number
  resolution?: { fullscreen?: boolean; monitor?: string }
}

interface GameStartEvent {
  showLog?: boolean
}

interface GameExitEvent {
  code?: number
  crashReport?: string
}

export interface GameLaunchLifecycleService {
  getProcesses(): unknown[]
  on(event: 'minecraft-window-ready', listener: (event: WindowReadyEvent) => void): this
  on(event: 'minecraft-start', listener: (event: GameStartEvent) => void): this
  on(event: 'minecraft-exit', listener: (event: GameExitEvent) => void): this
}

export interface GameLaunchLifecycleController {
  closeMonitorWindow(): void
  createMonitorWindow(): Promise<void>
  handleMinecraftExit(status: GameExitEvent): void
  handleMinecraftWindowReady(hideLauncher: boolean): void
  setGameRunning(running: boolean): void
}

export interface GameLaunchLifecycleHost {
  moveGameWindow(pid: number, monitor: string): Promise<void>
  warn(error: unknown): void
}

export function bindGameLaunchLifecycle(
  service: GameLaunchLifecycleService,
  controller: GameLaunchLifecycleController,
  host: GameLaunchLifecycleHost,
) {
  service.on('minecraft-window-ready', ({ hideLauncher, pid, resolution }) => {
    if (resolution?.fullscreen && resolution.monitor) {
      void host.moveGameWindow(pid, resolution.monitor).catch(error => host.warn(error))
    }
    controller.handleMinecraftWindowReady(!!hideLauncher)
  }).on('minecraft-start', ({ showLog }) => {
    controller.setGameRunning(service.getProcesses().length > 0)
    if (showLog) void controller.createMonitorWindow()
  }).on('minecraft-exit', (status) => {
    const running = service.getProcesses().length > 0
    controller.setGameRunning(running)
    controller.handleMinecraftExit(status)
    if (!running && !status.crashReport && status.code === 0) controller.closeMonitorWindow()
  })
}