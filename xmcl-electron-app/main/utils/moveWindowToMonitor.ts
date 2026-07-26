import type { MonitorBounds } from './gameWindow/shared'
import { screen } from 'electron'

export type { MonitorBounds } from './gameWindow/shared'

export function isMonitorSelectionSupported(platform = process.platform, environment = process.env) {
  return platform === 'win32' || platform === 'darwin' || (
    platform === 'linux' &&
    !!environment.DISPLAY &&
    environment.XDG_SESSION_TYPE?.toLowerCase() !== 'wayland'
  )
}

export async function moveWindowToMonitor(pid: number, bounds: MonitorBounds, platform = process.platform) {
  if (platform === 'win32') {
    const { moveWindowsWindow } = await import('./gameWindow/windows')
    return moveWindowsWindow(pid, screen.dipToScreenRect(null, bounds))
  }
  if (platform === 'darwin') {
    const { moveMacWindow } = await import('./gameWindow/macos')
    return moveMacWindow(pid, bounds)
  }
  if (platform === 'linux' && isMonitorSelectionSupported(platform)) {
    const { moveX11Window } = await import('./gameWindow/x11')
    return moveX11Window(pid, bounds)
  }
  throw new Error(`Fullscreen monitor selection is not supported on ${platform}`)
}