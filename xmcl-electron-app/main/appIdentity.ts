import { LAUNCHER_DISPLAY_NAME, LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { join } from 'path'
import { mkdirSync } from 'fs'

/** Apply before ready: packaged and development runs must never share XMCL's browser profile. */
export function configureAppIdentity(app: {
  setName(name: string): void
  getPath(name: 'appData'): string
  setPath(name: 'userData', path: string): void
}) {
  app.setName(LAUNCHER_DISPLAY_NAME)
  const userData = join(app.getPath('appData'), LAUNCHER_NAME)
  mkdirSync(userData, { recursive: true })
  app.setPath('userData', userData)
}
