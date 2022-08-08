import { diagnoseAssetIndex, diagnoseAssets, diagnoseFile, diagnoseJar, diagnoseLibraries, LibraryIssue, MinecraftFolder, ResolvedVersion } from '@xmcl/core'
import { diagnoseInstall, InstallProfile } from '@xmcl/installer'
import { Asset, AssetIndexIssueKey, AssetsIssueKey, getExpectVersion, getResolvedVersion, InstallableLibrary, InstallProfileIssueKey, Instance, InstanceVersionException, InstanceVersionService as IInstanceVersionService, InstanceVersionServiceKey, InstanceVersionState, IssueReportBuilder, LibrariesIssueKey, LocalVersionHeader, RuntimeVersions, VersionIssueKey, VersionJarIssueKey } from '@xmcl/runtime-api'
import { readFile, readJSON, stat } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { exists } from '../util/fs'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { DiagnoseService } from './DiagnoseService'
import { InstallService } from './InstallService'
import { InstanceService } from './InstanceService'
import { ExposeServiceKey, Lock, StatefulService } from './Service'
import { VersionService } from './VersionService'

@ExposeServiceKey(InstanceVersionServiceKey)
export class InstanceVersionService extends StatefulService<InstanceVersionState> implements IInstanceVersionService {
  private fixingAll = false

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(InstallService) private installService: InstallService,
  ) {
    super(app, InstanceVersionServiceKey, () => new InstanceVersionState())

    diagnoseService.register({
      id: VersionIssueKey,
      fix: async (issue) => {
        try {
          this.fixingAll = true
          const { minecraft, forge, fabricLoader, optifine, quiltLoader } = issue
          const version = await this.installRuntime({ minecraft, forge, fabricLoader, optifine, quiltLoader })
          if (version) {
            await this.versionService.refreshVersion(version)
            await this.installService.installDependencies(version)
          }
        } finally {
          this.fixingAll = false
        }
      },
      validator: async (builder, issue) => {
        const runtime = this.instanceService.state.instance.runtime
        const valid = runtime.minecraft === issue.minecraft && runtime.forge === issue.forge && runtime.fabricLoader === issue.fabricLoader && runtime.quiltLoader === issue.quiltLoader
        if (valid) {
          await this.diagnoseAll(builder, this.state.version)
        }
      },
    })

    diagnoseService.register({
      id: VersionJarIssueKey,
      fix: async (issue) => {
        const { minecraft, forge, fabricLoader, quiltLoader } = issue
        const mcVersions = await installService.getMinecraftVersionList()
        const metadata = mcVersions.versions.find(v => v.id === minecraft)
        if (metadata) {
          await installService.installMinecraft(metadata)
          if (forge) {
            const forgeVersions = await installService.getForgeVersionList({ minecraftVersion: minecraft })
            const found = forgeVersions.find(v => v.version === forge)
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
          if (quiltLoader) {
            await installService.installQuiltUnsafe({ version: quiltLoader, minecraftVersion: minecraft })
          }
          // TODO: check liteloader
        } else {
          this.emit('error', new InstanceVersionException({ type: 'fixVersionNoVersionMetadata', minecraft }))
        }
      },
      validator: async (builder, issue) => {
        if (this.state.version) {
          const runtime = this.instanceService.state.instance.runtime
          const valid = runtime.minecraft === issue.minecraft && runtime.forge === issue.forge
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
          if (this.state.version.minecraftVersion === issue.version || this.state.version.id === issue.version) {
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

        await installService.installAssets(assets, issue.version)
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

        await installService.installLibraries(libraries, issue.version)
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
        await installService.installByProfile(issue.installProfile, issue.version)
      },
      validator: async (builder, issue) => {
        if (this.state.version?.id === issue.version) {
          await this.diagnoseProfile(builder, issue.version, issue.minecraft, MinecraftFolder.from(this.state.version.minecraftDirectory))
        }
      },
    })

    this.storeManager
      .subscribe('instanceSelect', () => {
        const newVersion = this.getInstanceVersionHeader()
        this.log(`Update instance version: ${newVersion ? newVersion.id : undefined}`)
        this.state.instanceVersionHeader(newVersion)
      })
      .subscribe('instanceEdit', async (payload) => {
        if (payload.path !== this.instanceService.state.path) {
          return
        }
        if ('runtime' in payload) {
          const newVersion = this.getInstanceVersionHeader()
          this.log(`Update instance version: ${newVersion ? newVersion.id : undefined}`)
          this.state.instanceVersionHeader(newVersion)
        }
      })
      .subscribeAll(['localVersions', 'localVersionAdd', 'localVersionRemove'], async () => {
        const newVersion = this.getInstanceVersionHeader()
        if (newVersion !== this.state.version) {
          this.log(`Update instance version: ${newVersion ? newVersion.id : undefined}`)
          this.state.instanceVersionHeader(newVersion)
        }
      })
      .subscribe('instanceVersionHeader', () => {
        this.refresh()
      })
      .subscribe('instanceVersion', (v) => {
        this.diagnoseVersion(v)
      })
  }

  @Lock('refresh')
  async refresh() {
    if (this.state.versionHeader) {
      const ver = await this.versionService.resolveLocalVersion(this.state.versionHeader.id)
      this.state.instanceVersion(ver)
    } else {
      this.state.instanceVersion(undefined)
    }
  }

  /**
   * The selected instance mapped local version.
   * If there is no local version matched, it will return a local version with id equal to `""`.
   */
  getInstanceVersionHeader(): LocalVersionHeader | undefined {
    const instance = this.instanceService.state
    const version = this.versionService.state
    const current = instance.all[instance.path]
    if (!current) {
      return undefined
    }
    const header = getResolvedVersion(version.local, current.runtime, current.version)
    if (header) {
      return header
    }
    return undefined
  }

  async diagnoseLibraries(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder) {
    this.log(`Diagnose for version ${currentVersion.id} libraries`)
    const librariesIssues = await diagnoseLibraries(currentVersion, minecraft, { strict: false, checksum: this.worker().checksum })
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
      assetIndexIssue.version = assetIndexIssue.version || currentVersion.id
    }
    return assetIndexIssue
  }

  private async diagnoseAssets(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder, strict = false) {
    this.log(`Diagnose for version ${currentVersion.id} assets`)
    const objects: Record<string, { hash: string; size: number }> = (await readFile(minecraft.getAssetsIndex(currentVersion.assets), 'utf-8').then((b) => JSON.parse(b.toString()))).objects

    builder.set(AssetsIssueKey)
    const assetsIssues = await diagnoseAssets(objects, minecraft, { strict, checksum: this.worker().checksum })

    if (assetsIssues.length > 0) {
      builder.set(AssetsIssueKey, { version: currentVersion.id, assets: assetsIssues })
    }
  }

  async diagnoseJar(builder: IssueReportBuilder, currentVersion: ResolvedVersion, minecraft: MinecraftFolder, runtime: RuntimeVersions) {
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

  async installRuntime(runtime: Instance['runtime']) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine } = runtime
    const mcVersions = await this.installService.getMinecraftVersionList()
    const local = this.versionService.state.local
    if (!local.find(v => v.id === minecraft)) {
      const metadata = mcVersions.versions.find(v => v.id === minecraft)
      if (!metadata) {
        throw new InstanceVersionException({ type: 'fixVersionNoVersionMetadata', minecraft })
      }
      await this.installService.installMinecraft(metadata)
    }

    let forgeVersion = undefined as undefined | string
    if (forge) {
      const localForge = local.find(v => v.forge === forge)
      if (!localForge) {
        const forgeVersions = await this.installService.getForgeVersionList({ minecraftVersion: minecraft })
        const found = forgeVersions.find(v => v.version === forge)
        const forgeVersionId = found?.version ?? forge
        forgeVersion = await this.installService.installForgeUnsafe({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer })
      } else {
        forgeVersion = localForge.id
      }
    }

    if (optifine) {
      let optifineVersion = optifine
      if (optifineVersion.startsWith(minecraft)) {
        optifineVersion = optifineVersion.substring(minecraft.length)
      }
      const localOptifine = local.find(v => v.optifine === optifineVersion)
      if (localOptifine) {
        return localOptifine.id
      }
      const index = optifineVersion.indexOf('_')
      const type = optifineVersion.substring(0, index)
      const patch = optifineVersion.substring(index + 1)
      return await this.installService.installOptifineUnsafe({ type, patch, mcversion: minecraft, inheritFrom: forgeVersion })
    } else if (forgeVersion) {
      return forgeVersion
    }

    if (fabricLoader) {
      const localFabric = local.find(v => v.fabric === fabricLoader)
      if (localFabric) {
        return localFabric.id
      }
      return await this.installService.installFabricUnsafe({ loader: fabricLoader, minecraft })
    }

    if (quiltLoader) {
      const localQuilt = local.find(v => v.quilt === quiltLoader)
      if (localQuilt) {
        return localQuilt.id
      }
      return await this.installService.installQuiltUnsafe({ version: quiltLoader, minecraftVersion: minecraft })
    }
    // TODO: check liteloader
    return minecraft
  }

  async diagnoseAll(builder: IssueReportBuilder, currentVersion: ResolvedVersion | undefined) {
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
  @Lock('diagnoseVersion')
  private async diagnoseVersion(currentVersion: ResolvedVersion | undefined) {
    // Skip to diagnose as the install is not finished
    if (this.fixingAll) { return }
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
