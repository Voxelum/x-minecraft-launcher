import { InstalledAppManifest } from '@xmcl/runtime-api'
import { Client } from './Client'

/**
 * The controller is response to keep the communication between main process and renderer process
 */
export interface LauncherAppController {
  /**
   * Get the login success html content with current locale
   */
  getLoginSuccessHTML(): string
  /**
   * The api to request the launcher window focus
   */
  requireFocus(): void
  /**
   * Boot the app manifest.
   * @param app The app manifest to boot
   * @param isBootstrap If the app is in bootstarap mode
   */
  activate(app: InstalledAppManifest, isBootstrap?: boolean): Promise<void>
  /**
   * Handle a invoke operation from client
   *
   * @param channel The invoke channel to listen
   * @param handler The listener callback will be called during this event received
   */
  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any, once?: boolean): void
  /**
    * Broadcast a event with payload to client.
    *
    * @param channel The event channel to client
    * @param payload The event payload to client
    */
  broadcast(channel: string, ...payload: any[]): void
}
