import {
  VersionInstallServiceKey,
  type DiagnoseOptions,
  type VersionInstallRequest,
  type VersionInstallService as IVersionInstallService,
} from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { InstallCoordinator } from './InstallCoordinator'

@ExposeServiceKey(VersionInstallServiceKey)
export class VersionInstallService extends AbstractService implements IVersionInstallService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstallCoordinator) private coordinator: InstallCoordinator,
  ) {
    super(app)
  }

  install(
    request: Extract<VersionInstallRequest, { type: 'instance' }>,
  ): Promise<import('@xmcl/installer').InstanceVersionInstallResult>
  install(request: Extract<VersionInstallRequest, { type: 'server' }>): Promise<string>
  install(
    request: Extract<VersionInstallRequest, { type: 'java' }>,
  ): Promise<import('@xmcl/runtime-api').Java>
  install(
    request: Extract<VersionInstallRequest, { type: 'repair' | 'reinstall' | 'optifine-mod' }>,
  ): Promise<void>
  install(request: VersionInstallRequest) {
    return this.coordinator.install(request)
  }

  installInstance(request: Extract<VersionInstallRequest, { type: 'instance' }>) {
    return this.coordinator.install(request)
  }

  getSupportedMajorJavaVersions() {
    return this.coordinator.getSupportedMajorJavaVersions()
  }

  getJavaVendors(force?: boolean) {
    return this.coordinator.getJavaVendors(force)
  }

  getMajorJavaVersionsFromVendor(vendor: string, force?: boolean) {
    return this.coordinator.getMajorJavaVersionsFromVendor(vendor, force)
  }

  getJavaRuntimes(vendor: string, version: string, metadataSha256?: string, force?: boolean) {
    return this.coordinator.getJavaRuntimes(vendor, version, metadataSha256, force)
  }

  diagnose(options: DiagnoseOptions) {
    return this.coordinator.diagnose(options)
  }
}
