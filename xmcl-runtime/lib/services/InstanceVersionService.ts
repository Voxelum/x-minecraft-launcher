import { diagnose, MinecraftFolder } from '@xmcl/core'
import { diagnoseInstall, InstallProfile } from '@xmcl/installer'
import { Asset, DEFAULT_PROFILE, Exception, getExpectVersion, getResolvedVersion, InstallableLibrary, InstanceVersionException, InstanceVersionService as IInstanceVersionService, isSameForgeVersion, IssueReport, parseOptifineVersion, RuntimeVersions, versionLockOf } from '@xmcl/runtime-api'
import { readJSON } from 'fs-extra'
import { join, relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { exists } from '../util/fs'
import DiagnoseService from './DiagnoseService'
import InstallService from './InstallService'
import InstanceService from './InstanceService'
import AbstractService, { Inject, Singleton, Subscribe } from './Service'
import VersionService from './VersionService'

export default class InstanceVersionService extends AbstractService implements IInstanceVersionService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(InstallService) installService: InstallService,
  ) {
    super(app)

    diagnoseService.registerMatchedFix(['missingVersionJson', 'missingVersionJar', 'corruptedVersionJson', 'corruptedVersionJar'],
      async (issues) => {
        const i = issues[0]
        const { minecraft, forge, fabricLoader } = i.parameters! as RuntimeVersions
        const metadata = installService.state.minecraft.versions.find(v => v.id === minecraft)
        if (metadata) {
          await installService.installMinecraft(metadata)
          if (forge) {
            const found = installService.state.forge.find(f => f.mcversion === minecraft)
              ?.versions.find(v => v.version === forge)
            if (found) {
              const forge = found
              const fullVersion = await installService.installForgeUnsafe(forge)
              if (fullVersion) {
                // await this.install.installDependencies(fullVersion);
              }
            } else {
              this.emit('error', new InstanceVersionException({ type: 'fixVersionNoForgeVersionMetadata', minecraft, forge }))
            }
          }
          if (fabricLoader) {
            await installService.installFabricUnsafe({ loader: fabricLoader, minecraft })
          }

          // TODO: check liteloader
        } else {
          this.emit('error', new InstanceVersionException({ type: 'fixVersionNoVersionMetadata', minecraft }))
        }
      },
      this.diagnoseVersion.bind(this))

    diagnoseService.registerMatchedFix(['missingVersion'],
      async (issues) => {
        if (!issues[0].parameters) return
        const { minecraft, forge, fabricLoader, optifine } = issues[0].parameters as RuntimeVersions
        let targetVersion: string | undefined
        if (minecraft && this.versionService.state.local.every(v => v.minecraftVersion !== minecraft)) {
          if (installService.state.minecraft.versions.length === 0) {
            await installService.refreshMinecraft()
          }
          const metadata = installService.state.minecraft.versions.find(v => v.id === minecraft)
          if (metadata) {
            await installService.installMinecraft(metadata)
          }
          targetVersion = metadata?.id
        }
        if (forge) {
          let forges = installService.state.forge.find(v => v.mcversion === minecraft)
          if (!forges) {
            await installService.refreshForge({ mcversion: minecraft })
          }
          forges = installService.state.forge.find(v => v.mcversion === minecraft)
          const forgeVer = forges?.versions.find(v => isSameForgeVersion(v.version, forge))
          if (!forgeVer) {
            targetVersion = await installService.installForgeUnsafe({ mcversion: minecraft, version: forge })
          } else {
            targetVersion = await installService.installForgeUnsafe(forgeVer)
          }
        } else if (fabricLoader) {
          targetVersion = await installService.installFabricUnsafe({ minecraft, loader: fabricLoader })
        }
        if (optifine) {
          const { patch, type } = parseOptifineVersion(optifine)
          const id = await installService.installOptifine({ mcversion: minecraft, patch, type, inhrenitFrom: targetVersion })
          targetVersion = id
        }
        if (targetVersion) {
          await installService.installDependencies(targetVersion)
        }
      },
      this.diagnoseVersion.bind(this))

    diagnoseService.registerMatchedFix(['missingAssetsIndex', 'corruptedAssetsIndex'],
      (issues) => installService.installAssetsForVersion((issues[0].parameters as any).version),
      this.diagnoseVersion.bind(this))

    diagnoseService.registerMatchedFix(['missingAssets', 'corruptedAssets'],
      (issues) => {
        const assets: Asset[] = []

        for (const i of issues) {
          if (i.parameters instanceof Array) {
            assets.push(...(i.parameters as any))
          } else {
            assets.push(i.parameters as any)
          }
        }

        return installService.installAssets(assets)
      },
      this.diagnoseVersion.bind(this))

    diagnoseService.registerMatchedFix(['missingLibraries', 'corruptedLibraries'],
      async (issues) => {
        const libraries: InstallableLibrary[] = []

        for (const i of issues) {
          if (i.parameters instanceof Array) {
            libraries.push(...(i.parameters as any))
          } else {
            libraries.push(i.parameters as any)
          }
        }

        return installService.installLibraries(libraries)
      },
      this.diagnoseVersion.bind(this))

    diagnoseService.registerMatchedFix(['badInstall'],
      async (issues) => {
        await installService.installByProfile((issues[0].parameters as any).installProfile)
      },
      this.diagnoseVersion.bind(this))
  }

  @Subscribe('instanceSelect')
  protected async onInstanceSelect() {
    await this.diagnoseVersion()
  }

  @Subscribe('localVersions', 'localVersionAdd', 'localVersionRemove')
  protected async onLocalVersionsChanged() {
    await this.diagnoseVersion()
  }

  @Subscribe('instanceEdit')
  protected async onInstance(payload: any) {
    if (payload.path !== this.instanceService.state.path) {
      return
    }
    const report: Partial<IssueReport> = {}
    if ('runtime' in payload) {
      await this.diagnoseVersion()
      this.diagnoseService.report(report)
      return
    }
    this.diagnoseService.report(report)
  }

  /**
   * The selected instance mapped local version.
   * If there is no local version matched, it will return a local version with id equal to `""`.
   */
  getInstanceVersion() {
    const instance = this.instanceService.state
    const version = this.versionService.state
    const current = instance.all[instance.path] || DEFAULT_PROFILE
    return getResolvedVersion(version.local, current.runtime, current.version)
  }

  @Singleton()
  private async diagnoseVersion() {
    const report: Partial<IssueReport> = {}
    this.up('diagnose')
    try {
      const id = this.instanceService.state.path
      const selected = this.instanceService.state.all[id]
      if (!selected) {
        this.error(`Skip to diagnose version as no profile selected! ${id}`)
        return
      }
      this.log(`Diagnose version of ${selected.path}`)
      // await this.versionService.refreshVersions()
      const runtime = selected.runtime
      const currentVersion = this.getInstanceVersion()

      const targetVersion = currentVersion.id
      const mcversion = runtime.minecraft

      const mcLocation = MinecraftFolder.from(currentVersion.minecraftDirectory)

      type VersionReport = Pick<IssueReport,
        'missingVersionJar' |
        'missingAssetsIndex' |
        'missingVersionJson' |
        'missingLibraries' |
        'missingAssets' |
        'missingVersion' |

        'corruptedVersionJar' |
        'corruptedAssetsIndex' |
        'corruptedVersionJson' |
        'corruptedLibraries' |
        'corruptedAssets' |

        'badInstall'>

      const tree: VersionReport = {
        missingVersion: [],
        missingVersionJar: [],
        missingVersionJson: [],
        missingAssetsIndex: [],
        missingLibraries: [],
        missingAssets: [],

        corruptedVersionJar: [],
        corruptedAssetsIndex: [],
        corruptedVersionJson: [],
        corruptedLibraries: [],
        corruptedAssets: [],

        badInstall: [],
      }

      if (!targetVersion) {
        tree.missingVersion.push({ ...runtime, version: getExpectVersion(runtime) })
      } else {
        this.log(`Diagnose for version ${targetVersion}`)

        const location = this.getPath()
        const gameReport = await this.semaphoreManager.getLock(versionLockOf(targetVersion))
          .read(() => diagnose(targetVersion, location))

        for (const issue of gameReport.issues) {
          if (issue.role === 'versionJson') {
            if (issue.type === 'corrupted') {
              tree.corruptedVersionJson.push({ version: issue.version, ...runtime, file: relative(location, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum })
            } else {
              tree.missingVersionJson.push({ version: issue.version, ...runtime, file: relative(location, issue.file) })
            }
          } else if (issue.role === 'minecraftJar') {
            if (issue.type === 'corrupted') {
              tree.corruptedVersionJar.push({ version: issue.version, ...runtime, file: relative(location, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum })
            } else {
              tree.missingVersionJar.push({ version: issue.version, ...runtime, file: relative(location, issue.file) })
            }
          } else if (issue.role === 'assetIndex') {
            if (issue.type === 'corrupted') {
              tree.corruptedAssetsIndex.push({ version: issue.version, file: relative(location, issue.file), actual: 'issue.receivedChecksum', expect: issue.expectedChecksum })
            } else {
              tree.missingAssetsIndex.push({ version: issue.version, file: relative(location, issue.file) })
            }
          } else if (issue.role === 'asset') {
            if (issue.type === 'corrupted') {
              tree.corruptedAssets.push({ ...issue.asset, version: runtime.minecraft, hash: issue.asset.hash, file: relative(location, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum })
            } else {
              tree.missingAssets.push({ ...issue.asset, version: runtime.minecraft, hash: issue.asset.hash, file: relative(location, issue.file) })
            }
          } else if (issue.role === 'library') {
            if (issue.type === 'corrupted') {
              tree.corruptedLibraries.push({ ...issue.library, file: relative(location, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum })
            } else {
              tree.missingLibraries.push({ ...issue.library, file: relative(location, issue.file) })
            }
          }
        }

        const root = mcLocation.getVersionRoot(targetVersion)
        const installProfilePath = join(root, 'install_profile.json')
        if (await exists(installProfilePath)) {
          const installProfile: InstallProfile = await readJSON(installProfilePath)
          const report = await diagnoseInstall(installProfile, mcLocation.root)
          const missedInstallProfileLibs: IssueReport['missingLibraries'] = []
          const corruptedInstallProfileLibs: IssueReport['corruptedLibraries'] = []
          let badInstall = false
          for (const issue of report.issues) {
            if (issue.role === 'processor') {
              badInstall = true
            } else if (issue.role === 'library') {
              if (issue.type === 'corrupted') {
                corruptedInstallProfileLibs.push({ ...issue.library, file: relative(location, issue.file) })
              } else {
                missedInstallProfileLibs.push({ ...issue.library, file: relative(location, issue.file) })
              }
            }
          }
          if (badInstall) {
            tree.badInstall.push({ version: targetVersion, installProfile: report.installProfile, minecraft: mcversion })
            tree.corruptedLibraries.push(...corruptedInstallProfileLibs)
            tree.missingLibraries.push(...missedInstallProfileLibs)
          }
        }
      }
      Object.assign(report, tree)
      this.diagnoseService.report(report)
    } finally {
      this.down('diagnose')
    }
  }
}
