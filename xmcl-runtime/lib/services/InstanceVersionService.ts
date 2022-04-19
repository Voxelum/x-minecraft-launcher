import { diagnoseAssetIndex, diagnoseAssets, diagnoseJar, diagnoseLibraries, LibraryIssue, MinecraftFolder, ResolvedVersion } from '@xmcl/core'
import { diagnoseInstall, InstallProfile } from '@xmcl/installer'
import { Asset, AssetIndexIssueKey, AssetsIssueKey, getResolvedVersion, InstallableLibrary, InstallProfileIssueKey, InstanceVersionException, InstanceVersionService as IInstanceVersionService, InstanceVersionServiceKey, InstanceVersionState, isSameForgeVersion, LibrariesIssueKey, parseOptifineVersion, IssueReportBuilder, RuntimeVersions, VersionIssueKey, VersionJarIssueKey, getExpectVersion } from '@xmcl/runtime-api'
import { readFile, readJSON } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { exists } from '../util/fs'
import { DiagnoseService } from './DiagnoseService'
import { InstallService } from './InstallService'
import { InstanceService } from './InstanceService'
import { Inject, Singleton, StatefulService } from './Service'
import { VersionService } from './VersionService'

export class InstanceVersionService extends StatefulService<InstanceVersionState> implements IInstanceVersionService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(InstallService) installService: InstallService,
  ) {
    super(app, InstanceVersionServiceKey, () => new InstanceVersionState())

    diagnoseService.register({
      id: VersionIssueKey,
      fix: async (issue) => {
        const { minecraft, forge, fabricLoader, optifine } = issue
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
      validator: async (builder, issue) => {
        const runtime = this.instanceService.state.instance.runtime
        let valid = true
        for (const key in issue) {
          if (runtime[key] !== issue[key]) {
            valid = false
          }
        }
        if (valid) {
          await this.diagnoseAll(builder, this.state.version)
        }
      },
    })

    diagnoseService.register({
      id: VersionJarIssueKey,
      fix: async (issue) => {
        const { minecraft, forge, fabricLoader } = issue
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
      validator: async (builder, issue) => {
        if (this.state.version) {
          const runtime = this.instanceService.state.instance.runtime
          let valid = true
          for (const key in issue) {
            if (runtime[key] !== issue[key]) {
              valid = false
            }
          }
          if (valid) {
            // only if re-valid if the version unchanged
            await this.diagnoseJar(builder, this.state.version, MinecraftFolder.from(this.state.version.minecraftDirectory), runtime)
          }
        }
      },
    })

    diagnoseService.register({
      id: AssetIndexIssueKey,
      fix: (issue) => installService.installAssetsForVersion(issue.version),
      validator: async (builder, issue) => {
        if (this.state.version) {
          if (this.state.version.assetIndex.id === issue.version) {
            // only if re-valid if the version unchanged
            await this.diagnoseAssetIndex(builder, this.state.version, MinecraftFolder.from(this.state.version.minecraftDirectory))
          }
        }
      },
    })

    diagnoseService.register({
      id: AssetsIssueKey,
      fix: async (issue) => {
        const assets: Asset[] = []

        for (const i of issue.assets) {
          assets.push(i.asset)
        }

        await installService.installAssets(assets)
      },
      merge: (issue) => issue.reduce((a, b) => ({ version: a.version, assets: [...a.assets, ...b.assets] })),
      validator: async (builder, issue) => {
        if (this.state.version?.id === issue.version) {
          await this.diagnoseAssets(builder, this.state.version, MinecraftFolder.from(this.state.version.minecraftDirectory))
        }
      },
    })

    diagnoseService.register({
      id: LibrariesIssueKey,
      fix: async (issue) => {
        const libraries: InstallableLibrary[] = []

        for (const i of issue.libraries) {
          libraries.push(i.library)
        }

        await installService.installLibraries(libraries)
      },
      merge: (issue) => issue.reduce((a, b) => ({ version: a.version, libraries: [...a.libraries, ...b.libraries] })),
      validator: async (builder, issue) => {
        if (this.state.version?.id === issue.version) {
          await this.diagnoseLibraries(builder, this.state.version, MinecraftFolder.from(this.state.version.minecraftDirectory))
        }
      },
    })

    diagnoseService.register({
      id: InstallProfileIssueKey,
      fix: async (issue) => {
        await installService.installByProfile(issue.installProfile)
      },
      validator: async (builder, issue) => {
        if (this.state.version?.id === issue.version) {
          this.diagnoseProfile(builder, issue.version, issue.minecraft, MinecraftFolder.from(this.state.version.minecraftDirectory))
        }
      },
    })

    this.storeManager
      .subscribe('instanceSelect', () => {
        this.state.instanceVersion(this.getInstanceVersion())
      })
      .subscribe('instanceEdit', async (payload) => {
        if (payload.path !== this.instanceService.state.path) {
          return
        }
        if ('runtime' in payload) {
          const newVersion = this.getInstanceVersion()
          if (newVersion !== this.state.version) {
            this.state.instanceVersion(newVersion)
          }
        }
      })
      .subscribeAll(['localVersions', 'localVersionAdd', 'localVersionRemove'], async () => {
        const newVersion = this.getInstanceVersion()
        if (newVersion !== this.state.version) {
          this.state.instanceVersion(newVersion)
        }
      })
      .subscribe('instanceVersion', (v) => {
        this.diagnoseVersion(v)
      })
  }

  /**
   * The selected instance mapped local version.
   * If there is no local version matched, it will return a local version with id equal to `""`.
   */
  getInstanceVersion(): ResolvedVersion | undefined {
    const instance = this.instanceService.state
    const version = this.versionService.state
    const current = instance.all[instance.path]
    if (!current) {
      return undefined
    }
    return getResolvedVersion(version.local, current.runtime, current.version)
  }

  private async diagnoseLibraries(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder) {
    this.log(`Diagnose for version ${currentVersion.id} libraries`)
    const librariesIssues = await diagnoseLibraries(currentVersion, minecraft)
    builder.set(LibrariesIssueKey)
    if (librariesIssues.length > 0) {
      builder.set(LibrariesIssueKey, { version: currentVersion.id, libraries: librariesIssues })
    }
  }

  private async diagnoseAssetIndex(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder) {
    this.log(`Diagnose for version ${currentVersion.id} assets index`)
    const assetIndexIssue = await diagnoseAssetIndex(currentVersion, minecraft)
    builder.set(AssetIndexIssueKey)
    if (assetIndexIssue) {
      builder.set(AssetIndexIssueKey, assetIndexIssue)
    }
    return assetIndexIssue
  }

  private async diagnoseAssets(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder) {
    this.log(`Diagnose for version ${currentVersion.id} assets`)
    const objects = (await readFile(minecraft.getAssetsIndex(currentVersion.assets), 'utf-8').then((b) => JSON.parse(b.toString()))).objects
    const assetsIssues = await diagnoseAssets(objects, minecraft)

    builder.set(AssetsIssueKey)
    if (assetsIssues.length > 0) {
      builder.set(AssetsIssueKey, { version: currentVersion.id, assets: assetsIssues })
    }
  }

  private async diagnoseJar(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder, runtime: RuntimeVersions) {
    this.log(`Diagnose for version ${currentVersion.id} jar`)
    const jarIssue = await diagnoseJar(currentVersion, minecraft)

    builder.set(VersionJarIssueKey)
    if (jarIssue) {
      builder.set(VersionJarIssueKey, { ...jarIssue, ...runtime })
    }
  }

  private async diagnoseProfile(builder: IssueReportBuilder, version: string, mcVersion: string, minecraft: MinecraftFolder) {
    const root = minecraft.getVersionRoot(version)
    const installProfilePath = join(root, 'install_profile.json')
    builder.set(InstallProfileIssueKey)
    if (await exists(installProfilePath)) {
      const installProfile: InstallProfile = await readJSON(installProfilePath)
      const report = await diagnoseInstall(installProfile, minecraft.root)
      let badInstall = false
      const librariesIssues: LibraryIssue[] = []
      for (const issue of report.issues) {
        if (issue.role === 'processor') {
          badInstall = true
        } else if (issue.role === 'library') {
          librariesIssues.push(issue)
        }
      }
      if (librariesIssues.length > 0) {
        builder.set(LibrariesIssueKey, { version, libraries: librariesIssues })
      }
      if (badInstall) {
        builder.set(InstallProfileIssueKey, { version, installProfile: report.installProfile, minecraft: mcVersion })
      }
    }
  }

  private async diagnoseAll(builder: IssueReportBuilder, currentVersion: ResolvedVersion | undefined) {
    const id = this.instanceService.state.path
    const selected = this.instanceService.state.all[id]
    if (!selected) {
      this.error(`Skip to diagnose version as no profile selected! ${id}`)
      return
    }

    builder.set(VersionIssueKey)
    builder.set(VersionJarIssueKey)
    builder.set(AssetsIssueKey)
    builder.set(LibrariesIssueKey)
    builder.set(InstallProfileIssueKey)

    this.log(`Diagnose version of ${selected.path}`)
    const runtime = selected.runtime

    if (!currentVersion) {
      builder.set(VersionIssueKey, { ...runtime, version: getExpectVersion(runtime) })
      this.diagnoseService.report(builder.build())
      return
    }

    const targetVersion = currentVersion.id
    const mcversion = runtime.minecraft

    const location = this.getPath()
    const minecraft = MinecraftFolder.from(location)

    await this.diagnoseJar(builder, currentVersion, minecraft, runtime)
    const assetIndexIssue = await this.diagnoseAssetIndex(builder, currentVersion, minecraft)
    await this.diagnoseLibraries(builder, currentVersion, minecraft)

    builder.set(AssetsIssueKey)
    if (!assetIndexIssue) {
      await this.diagnoseAssets(builder, currentVersion, minecraft)
    }

    await this.diagnoseProfile(builder, targetVersion, mcversion, minecraft)
  }

  /**
   * Diagnose full version
   */
  @Singleton()
  private async diagnoseVersion(currentVersion: ResolvedVersion | undefined) {
    this.up('diagnose')
    const builder = new IssueReportBuilder()
    try {
      await this.diagnoseAll(builder, currentVersion)
      this.diagnoseService.report(builder.build())
    } finally {
      this.down('diagnose')
    }
  }
}
