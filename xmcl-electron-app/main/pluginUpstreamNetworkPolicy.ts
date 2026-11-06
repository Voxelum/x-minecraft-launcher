import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { app, session, type Session } from 'electron'
import { isUpstreamLauncherUrl } from './upstreamNetworkPolicy'

/** Chromium checks each redirect and WebSocket handshake before connecting. */
export const pluginUpstreamNetworkPolicy: LauncherAppPlugin = () => {
  const installed = new WeakSet<Session>()
  const install = (target: Session) => {
    if (installed.has(target)) return
    installed.add(target)
    target.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: isUpstreamLauncherUrl(details.url) })
    })
  }
  app.on('session-created', install)
  app.whenReady().then(() => install(session.defaultSession))
}
