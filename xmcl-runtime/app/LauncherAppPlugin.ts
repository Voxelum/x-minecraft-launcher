import { AppManifest } from '@xmcl/runtime-api'
import { LauncherApp } from './LauncherApp'

export interface LauncherAppPlugin {
  (app: LauncherApp, manifest: AppManifest): void
}
