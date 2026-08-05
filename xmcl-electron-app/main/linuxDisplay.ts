import { existsSync } from 'fs'

export type LinuxDisplaySetupFailureReason =
  | 'no-graphical-session'
  | 'xwayland-missing'
  | 'xwayland-not-running'
  | 'environment-missing'
  | 'sandbox-denied'

export type LinuxDisplaySetupResult = {
  type: 'ready'
  env: NodeJS.ProcessEnv
  recovered: boolean
} | {
  type: 'unavailable'
  reason: LinuxDisplaySetupFailureReason
}

export interface LinuxDisplayDiagnostics {
  xwaylandAvailable: boolean
  x11SocketAvailable: boolean
}

export function parseSystemdUserEnvironment(output: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {}
  for (const line of output.split(/\r?\n/g)) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.substring(0, separator)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    result[key] = line.substring(separator + 1)
  }
  return result
}

export function getLocalX11Socket(display: string): string | undefined {
  const match = /^(?:unix\/)?:(\d+)(?:\.\d+)?$/.exec(display)
  return match ? `/tmp/.X11-unix/X${match[1]}` : undefined
}

export function resolveLinuxDisplayEnvironment(
  env: NodeJS.ProcessEnv,
  sessionEnvironment: NodeJS.ProcessEnv,
  diagnostics: LinuxDisplayDiagnostics,
  exists: (path: string) => boolean = existsSync,
): LinuxDisplaySetupResult {
  if (env.DISPLAY) {
    return { type: 'ready', env, recovered: false }
  }

  const display = sessionEnvironment.DISPLAY
  const socket = display ? getLocalX11Socket(display) : undefined
  if (display && socket && exists(socket)) {
    const recovered: NodeJS.ProcessEnv = { ...env, DISPLAY: display }
    for (const key of ['WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR'] as const) {
      if (!recovered[key] && sessionEnvironment[key]) {
        recovered[key] = sessionEnvironment[key]
      }
    }
    const xauthority = sessionEnvironment.XAUTHORITY
    if (!recovered.XAUTHORITY && xauthority && exists(xauthority)) {
      recovered.XAUTHORITY = xauthority
    }
    return { type: 'ready', env: recovered, recovered: true }
  }

  if (env.FLATPAK_ID) {
    return { type: 'unavailable', reason: 'sandbox-denied' }
  }
  if (!env.WAYLAND_DISPLAY && !sessionEnvironment.WAYLAND_DISPLAY) {
    return { type: 'unavailable', reason: 'no-graphical-session' }
  }
  if (!diagnostics.x11SocketAvailable) {
    if (!diagnostics.xwaylandAvailable) {
      return { type: 'unavailable', reason: 'xwayland-missing' }
    }
    return { type: 'unavailable', reason: 'xwayland-not-running' }
  }
  return { type: 'unavailable', reason: 'environment-missing' }
}