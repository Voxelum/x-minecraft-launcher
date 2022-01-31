import { InstalledAppManifest } from '@xmcl/runtime-api'

export interface LauncherAppController {
  /**
   * Should launch windows as wizard to let user select the workspace
   * @return the workspace user selected
   */
  processFirstLaunch(): Promise<string>
  /**
   * The api to request the launcher window focus
   */
  requireFocus(): void
  /**
   * Boot the app manifest.
   */
  bootApp(app: InstalledAppManifest): Promise<void>

  dataReady(): Promise<void>
}
