import {
  AppManifest,
  AppsService as IAppsService,
  AppsServiceKey,
  InstalledAppManifest,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { LauncherApp } from '~/app/LauncherApp'
import { AbstractService, ExposeServiceKey } from '~/service'

@ExposeServiceKey(AppsServiceKey)
export class AppsService extends AbstractService implements IAppsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  getInstalledApps(): Promise<InstalledAppManifest[]> {
    return this.app.launcherAppManager.getInstalledApps()
  }

  installApp(url: string): Promise<InstalledAppManifest> {
    return this.app.launcherAppManager.installApp(url)
  }

  uninstallApp(url: string): Promise<void> {
    return this.app.launcherAppManager.uninstallApp(url)
  }

  getAppInfo(url: string): Promise<AppManifest> {
    return this.app.launcherAppManager.getAppInfo(url)
  }

  getDefaultApp(): Promise<string> {
    return this.app.launcherAppManager.getDefaultApp()
  }

  bootAppByUrl(url: string): Promise<void> {
    return this.app.launcherAppManager.bootAppByUrl(url)
  }

  createShortcut(url: string): Promise<void> {
    return this.app.launcherAppManager.createShortcut(url)
  }
}
