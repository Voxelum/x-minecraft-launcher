import { InstalledAppManifest } from '@xmcl/runtime-api'
import { Client } from '../engineBridge'

/**
 * The controller is response to keep the communication between main process and renderer process
 */
export interface LauncherAppController {
  /**
   * Should launch windows as wizard to let user select the workspace
   * @return the workspace user selected
   */
  processFirstLaunch(): Promise<{ path: string; instancePath: string; locale: string }>
  /**
   * The api to request the launcher window focus
   */
  requireFocus(): void
  /**
   * Boot the app manifest.
   */
  activate(app: InstalledAppManifest): Promise<void>
  /**
   * Handle a invoke operation from client
   *
   * @param channel The invoke channel to listen
   * @param handler The listener callback will be called during this event received
   */
  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any): void
  /**
    * Broadcast a event with payload to client.
    *
    * @param channel The event channel to client
    * @param payload The event payload to client
    */
  broadcast(channel: string, ...payload: any[]): void
}
