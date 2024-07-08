import { AssetIndexIssue, AssetIssue, diagnoseAssetIndex, diagnoseAssets, diagnoseJar, diagnoseLibraries, LibraryIssue, MinecraftFolder, MinecraftJarIssue, ResolvedVersion } from '@xmcl/core'
import { diagnoseInstall, InstallProfile, InstallProfileIssueReport } from '@xmcl/installer'
import { DiagnoseServiceKey, DiagnoseService as IDiagnoseService, RuntimeVersions, Version } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { kResourceWorker, ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { exists } from '../util/fs'

@ExposeServiceKey(DiagnoseServiceKey)
export class DiagnoseService extends AbstractService implements IDiagnoseService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kResourceWorker) private worker: ResourceWorker,
  ) {
    super(app)
  }

  async diagnoseLibraries(currentVersion: ResolvedVersion): Promise<LibraryIssue[]> {
    this.log(`Diagnose for version ${currentVersion.id} libraries`)
    const librariesIssues = await diagnoseLibraries(currentVersion, new MinecraftFolder(this.getPath()), { strict: false, checksum: this.worker.checksum })
    return librariesIssues
  }

  async diagnoseAssetIndex(currentVersion: ResolvedVersion): Promise<AssetIndexIssue | undefined> {
    this.log(`Diagnose for version ${currentVersion.id} assets index`)
    const assetIndexIssue = await diagnoseAssetIndex(currentVersion, new MinecraftFolder(this.getPath()))
    if (assetIndexIssue) {
      assetIndexIssue.version = assetIndexIssue.version || currentVersion.id
      return assetIndexIssue
    }
  }

  async diagnoseAssets(currentVersion: ResolvedVersion, strict = false): Promise<AssetIssue[]> {
    this.log(`Diagnose for version ${currentVersion.id} assets`)
    const minecraft = new MinecraftFolder(this.getPath())
    const objects: Record<string, { hash: string; size: number }> = (await readFile(minecraft.getAssetsIndex(currentVersion.assets), 'utf-8').then((b) => JSON.parse(b.toString()))).objects

    const assetsIssues = await diagnoseAssets(objects, minecraft, { strict, checksum: this.worker.checksum })

    return assetsIssues
  }

  async diagnoseJar(currentVersion: ResolvedVersion, side: 'client' | 'server' = 'client'): Promise<MinecraftJarIssue | undefined> {
    this.log(`Diagnose for version ${currentVersion.id} jar`)
    const minecraft = new MinecraftFolder(this.getPath())
    const jarIssue = await diagnoseJar(currentVersion, minecraft, { side })

    return jarIssue
  }

  async diagnoseProfile(version: string, side: 'client' | 'server' = 'client', path?: string): Promise<InstallProfileIssueReport | undefined> {
    const minecraft = new MinecraftFolder(path ?? this.getPath())
    const root = minecraft.getVersionRoot(version)
    const installProfilePath = join(root, 'install_profile.json')
    if (await exists(installProfilePath)) {
      const installProfile: InstallProfile = JSON.parse(await readFile(installProfilePath, 'utf8'))
      const report = await diagnoseInstall(installProfile, minecraft.root, side)
      let badInstall = false
      const librariesIssues: LibraryIssue[] = []
      for (const issue of report.issues) {
        if (issue.role === 'processor') {
          badInstall = true
        } else if (issue.role === 'library') {
          librariesIssues.push(issue)
        }
      }
      if (librariesIssues.length > 0 || badInstall) {
        return report
      }
    }
  }
}
