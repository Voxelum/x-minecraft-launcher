import { existsSync } from 'fs'
import { isAbsolute, join } from 'path'

export function getOzonePlatform(env: NodeJS.ProcessEnv, exists = existsSync): 'auto' | 'x11' {
  if (!env.DISPLAY) return 'auto'

  const waylandDisplay = env.WAYLAND_DISPLAY
  if (!waylandDisplay) return 'x11'

  const socket = isAbsolute(waylandDisplay)
    ? waylandDisplay
    : env.XDG_RUNTIME_DIR
      ? join(env.XDG_RUNTIME_DIR, waylandDisplay)
      : undefined

  return socket && exists(socket) ? 'auto' : 'x11'
}
