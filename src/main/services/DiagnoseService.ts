import { diagnose, LibraryInfo, MinecraftFolder } from '@xmcl/core'
import { diagnoseInstall, InstallProfile } from '@xmcl/installer'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { PackMeta } from '@xmcl/resourcepack'
import { readJson, readJSON } from 'fs-extra'
import { basename, join, relative } from 'path'
import { AUTHLIB_ORG_NAME } from '../constant'
import { AggregateExecutor } from '../util/aggregator'
import AbstractService, { ExportService, Singleton, Subscribe } from './Service'
import LauncherApp from '/@main/app/LauncherApp'
import { exists, missing, validateSha256 } from '/@main/util/fs'
import { Issue, IssueReport } from '/@shared/entities/issue'
import { EMPTY_JAVA } from '/@shared/entities/java'
import { ForgeModCommonMetadata } from '/@shared/entities/mod'
import { FabricResource } from '/@shared/entities/resource'
import { compareRelease, getExpectVersion } from '/@shared/entities/version'
import { DiagnoseService as IDiagnoseService, DiagnoseServiceKey } from '/@shared/services/DiagnoseService'
import { parseVersion, VersionRange } from '/@shared/util/mavenVersion'

export type DiagnoseFunction = (report: Partial<IssueReport>) => Promise<void>
export interface Fix {
  match(issues: readonly Issue[]): boolean
  fix(issues: readonly Issue[]): Promise<void>
  recheck: DiagnoseFunction
}

/**
 * This is the service provides the diagnose service for current launch profile
 */
@ExportService(DiagnoseServiceKey)
export default class DiagnoseService extends AbstractService implements IDiagnoseService {
  private fixes: Fix[] = []

  private postIssue = new AggregateExecutor<Partial<IssueReport>, Partial<IssueReport>>(r => r.reduce((prev, cur) => Object.assign(prev, cur), {}),
    (report) => this.commit('issuesPost', report),
    500)

  constructor(app: LauncherApp) {
    super(app)
  }

  registerMatchedFix(matched: string[], fixFunc: (issues: Issue[]) => Promise<any> | void, recheck: DiagnoseFunction = async () => { }) {
    this.fixes.push({
      match(issues) {
        return issues.some(i => matched.indexOf(i.id) !== -1)
      },
      fix(issues) {
        const filtered = issues.filter(i => matched.indexOf(i.id) !== -1)
        const result = fixFunc(filtered)
        if (result instanceof Promise) { return result.then(() => { }) }
        return Promise.resolve(result)
      },
      recheck,
    })
  }

  @Subscribe('instanceSelect')
  async onInstanceSelect() {
    this.aquire('diagnose')
    const report: Partial<IssueReport> = {}
    await this.diagnoseVersion(report)
    await this.diagnoseJava(report)
    await this.diagnoseServer(report)
    // await this.diagnoseCustomSkin(report);
    this.report(report)
    this.release('diagnose')
  }

  @Subscribe('javaUpdate', 'javaRemove')
  async onJavaUpdate() {
    this.aquire('diagnose')
    const report: Partial<IssueReport> = {}
    await this.diagnoseJava(report)
    this.report(report)
    this.release('diagnose')
  }

  @Subscribe('localVersions')
  async onLocalVersionsChanegd() {
    this.aquire('diagnose')
    const report: Partial<IssueReport> = {}
    await this.diagnoseVersion(report)
    this.report(report)
    this.release('diagnose')
  }

  @Subscribe('instanceMods', 'instanceModAdd', 'instanceModRemove')
  async onInstanceModsLoad() {
    this.aquire('diagnose')
    const report: Partial<IssueReport> = {}
    await this.diagnoseMods(report)
    this.report(report)
    this.release('diagnose')
  }

  @Subscribe('instanceGameSettings')
  async onInstanceResourcepacksLaod(payload: any) {
    if ('resourcePacks' in payload) {
      this.aquire('diagnose')
      const report: Partial<IssueReport> = {}
      await this.diagnoseResourcePacks(report)
      this.report(report)
      this.release('diagnose')
    }
  }

  @Subscribe('instance')
  async onInstance(payload: any) {
    if (payload.path !== this.state.instance.path) {
      return
    }
    const report: Partial<IssueReport> = {}
    if ('runtime' in payload) {
      this.aquire('diagnose')
      await this.diagnoseVersion(report)
      await this.diagnoseJava(report)
      await this.diagnoseServer(report)
      // await this.diagnoseCustomSkin(report);
      this.release('diagnose')
      this.report(report)
      return
    }
    if ('java' in payload) {
      await this.diagnoseJava(report)
    }
    this.report(report)
  }

  @Subscribe('userGameProfileSelect', 'userProfileUpdate', 'userSnapshot')
  async onUserUpdate() {
    const report: Partial<IssueReport> = {}
    // await this.diagnoseCustomSkin(report);
    await this.diagnoseUser(report)
    this.report(report)
  }

  @Subscribe('instanceStatus')
  async onInstanceStatus() {
    const report: Partial<IssueReport> = {}
    await this.diagnoseServer(report)
    this.report(report)
  }

  @Singleton()
  async diagnoseMods(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      const { runtime: version } = this.getters.instance
      this.log(`Diagnose mods under ${version.minecraft}`)
      const mods = this.state.instanceResource.mods
      if (typeof mods === 'undefined') {
        this.warn(`The instance mods folder is undefined ${this.state.instance.path}!`)
        return
      }

      const mcversion = version.minecraft
      const resolvedMcVersion = parseVersion(mcversion)
      const pattern = /^\[.+\]$/

      const tree: Pick<IssueReport, 'unknownMod' | 'incompatibleMod' | 'requireForge' | 'requireFabric' | 'requireFabricAPI'> = {
        unknownMod: [],
        incompatibleMod: [],
        requireForge: [],
        requireFabric: [],
        requireFabricAPI: [],
      }
      const forgeMods = mods.filter(m => !!m && m.type === 'forge')
      for (const mod of forgeMods) {
        const meta = mod.metadata as ForgeModCommonMetadata
        const acceptVersion = meta.acceptMinecraft
        if (!acceptVersion) {
          tree.unknownMod.push({ name: mod.name, actual: mcversion })
          continue
        }
        const range = VersionRange.createFromVersionSpec(acceptVersion)
        if (range && !range.containsVersion(resolvedMcVersion)) {
          tree.incompatibleMod.push({ name: mod.name, accepted: acceptVersion, actual: mcversion })
        }
      }
      if (forgeMods.length > 0) {
        if (!version.forge) {
          tree.requireForge.push({})
        }
      }

      const fabricMods = mods.filter(m => m.type === 'fabric') as FabricResource[]
      if (fabricMods.length > 0) {
        if (!version.fabricLoader) {
          tree.requireFabric.push({})
        }
        for (const mod of fabricMods) {
          const fabMetadata = mod.metadata as FabricModMetadata
          if (fabMetadata.depends) {
            const fabApiVer = (fabMetadata.depends as any).fabric
            if (fabApiVer && !fabricMods.some(m => m.metadata.id === 'fabric')) {
              tree.requireFabricAPI.push({ version: fabApiVer, name: mod.name })
            }
          }
        }
      }

      Object.assign(report, tree)
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseResourcePacks(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      this.log('Diagnose resource packs')
      const { runtime: version } = this.getters.instance
      const resourcePacks = this.state.instanceGameSetting.resourcePacks
      const resources = resourcePacks.map((name) => this.state.resource.resourcepacks.find((pack) => `file/${pack.name}${pack.ext}` === name))

      const mcversion = version.minecraft
      const resolvedMcVersion = parseVersion(mcversion)

      const tree: Pick<IssueReport, 'incompatibleResourcePack'> = {
        incompatibleResourcePack: [],
      }

      const packFormatMapping = this.state.client.packFormatMapping.mcversion
      for (const pack of resources) {
        if (!pack) continue
        const metadata = pack.metadata as PackMeta.Pack
        if (metadata.pack_format in packFormatMapping) {
          const acceptVersion = packFormatMapping[metadata.pack_format]
          const range = VersionRange.createFromVersionSpec(acceptVersion)
          if (range && !range.containsVersion(resolvedMcVersion)) {
            tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion })
          }
        }
      }

      Object.assign(report, tree)
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseUser(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    const doesAuthlibInjectionExisted = async () => {
      const jsonPath = this.getPath('authlib-injection.json')
      const content = await readJson(jsonPath).catch(() => undefined)
      if (!content) return false
      const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`)
      const mc = new MinecraftFolder(this.getPath())
      const libPath = mc.getLibraryByPath(info.path)
      return validateSha256(libPath, content.checksums.sha256)
    }
    try {
      const user = this.state.user.users[this.state.user.selectedUser.id]

      this.log(`Diagnose user ${user.username}`)
      if (user) {
        const tree: Pick<IssueReport, 'missingAuthlibInjector'> = {
          missingAuthlibInjector: [],
        }

        if (user.authService !== 'mojang' && user.authService !== 'offline' && user.authService !== 'microsoft') {
          if (!await doesAuthlibInjectionExisted()) {
            tree.missingAuthlibInjector.push({})
          }
        }
        Object.assign(report, tree)
      }
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseCustomSkin(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      const user = this.state.user.users[this.state.user.selectedUser.id]
      const tree: Pick<IssueReport, 'missingCustomSkinLoader'> = {
        missingCustomSkinLoader: [],
      }
      if (user) {
        if (user.profileService !== 'mojang') {
          const instance = this.state.instance.all[this.state.instance.path]
          const { minecraft, fabricLoader, forge } = instance.runtime
          if ((!forge && !fabricLoader) || forge) {
            if (compareRelease(minecraft, '1.8.9') >= 0) {
              // use forge by default
              const res = this.state.instanceResource.mods.find((r) => r.type === 'forge' && (r.metadata as any)[0].modid === 'customskinloader')
              if (!res || !forge) {
                tree.missingCustomSkinLoader.push({
                  target: 'forge',
                  skinService: user.profileService,
                  missingJar: !res,
                  noVersionSelected: !forge,
                })
              }
            } else {
              this.warn('Current support on custom skin loader forge does not support version below 1.8.9!')
            }
          } else if (compareRelease(minecraft, '1.14') >= 0) {
            const res = this.state.instanceResource.mods.find((r) => r.type === 'fabric' && (r.metadata as any).id === 'customskinloader')
            if (!res) {
              tree.missingCustomSkinLoader.push({
                target: 'fabric',
                skinService: user.profileService,
                missingJar: true,
                noVersionSelected: false,
              })
            }
          } else {
            this.warn('Current support on custom skin loader fabric does not support version below 1.14!')
          }
        }
      }

      Object.assign(report, tree)
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseJava(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      this.log('Diagnose java')
      const instance = this.getters.instance
      const instanceJava = this.getters.instanceJava

      const mcversion = instance.runtime.minecraft
      const resolvedMcVersion = parseVersion(mcversion)

      const tree: Pick<IssueReport, 'incompatibleJava' | 'invalidJava' | 'missingJava'> = {
        incompatibleJava: [],
        missingJava: [],
        invalidJava: [],
      }

      if (instanceJava === EMPTY_JAVA || this.getters.missingJava) {
        tree.missingJava.push({})
      } else if (!instanceJava.valid || await missing(instanceJava.path)) {
        if (this.state.java.all.length === 0) {
          tree.missingJava.push({})
        } else {
          tree.invalidJava.push({ java: instanceJava.path })
        }
      } else if (instanceJava.majorVersion > 8) {
        if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
          tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft' })
        } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && instanceJava.majorVersion > 10) {
          tree.incompatibleJava.push({ java: instanceJava.version, version: instance.runtime.forge, type: 'MinecraftForge' })
        }
      }

      Object.assign(report, tree)
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseFailure(log: string) {
    const tree: Pick<IssueReport, 'badForge'> = {
      badForge: [],
    }

    const lines = log.split('\n').map(l => l.trim()).filter(l => l.length !== 0)
    for (const line of lines) {
      const reg = line.match(/\[main\/FATAL\] \[net\.minecraftforge\.fml\.loading\.FMLCommonLaunchHandler\/CORE\]: Failed to find Minecraft resource version/)
      if (reg) {
        const path = reg[2]
        const jarName = basename(path)
        const [, minecraft, forge] = jarName.substring(0, jarName.length - '-client.jar'.length).split('-')
        tree.badForge.push({ minecraft, forge })
      }
    }

    this.report(tree)
  }

  @Singleton()
  async diagnoseServer(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      this.log('Diagnose server status')
      const stat = this.getters.instance.serverStatus

      const tree: Pick<IssueReport, 'missingModsOnServer'> = {
        missingModsOnServer: [],
      }

      if (stat && stat.modinfo) {
        const info = stat.modinfo
        tree.missingModsOnServer.push(...info.modList)
      }

      Object.assign(report, tree)
    } finally {
      this.release('diagnose')
    }
  }

  @Singleton()
  async diagnoseVersion(report: Partial<IssueReport>) {
    this.aquire('diagnose')
    try {
      const id = this.state.instance.path
      const selected = this.state.instance.all[id]
      this.log(`Diagnose version of ${selected.path}`)
      if (!selected) {
        this.error(`No profile selected! ${id}`)
        return
      }
      // await this.versionService.refreshVersions()
      const runtime = selected.runtime
      const currentVersion = this.getters.instanceVersion

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
        const gameReport = await diagnose(targetVersion, location)

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
    } finally {
      this.release('diagnose')
    }
  }

  /**
   * Report certain issues.
   * @param report The partial issue report
   */
  report(report: Partial<IssueReport>) {
    for (const [key, value] of Object.entries(report)) {
      const reg = this.state.diagnose[key]
      if (value && reg.actived.length === 0 && value.length === 0) {
        delete report[key]
      }
    }
    this.postIssue.push(report)
  }

  /**
   * Fix all provided issues
   * @param issues The issues to be fixed.
   */
  async fix(issues: readonly Issue[]) {
    this.aquire('diagnose')
    try {
      const unfixed = issues.filter(p => p.autofix)
        .filter(p => !this.state.diagnose[p.id].fixing)

      if (unfixed.length === 0) return

      this.log(`Start fixing ${issues.length} issues: ${JSON.stringify(issues.map(i => i.id))}`)

      const rechecks: Array<DiagnoseFunction> = []

      this.commit('issuesStartResolve', unfixed)
      try {
        for (const fix of this.fixes) {
          if (fix.match(issues)) {
            await fix.fix(issues).catch(e => this.pushException({ type: 'issueFix', error: e }))
            if (fix.recheck) {
              rechecks.push(fix.recheck)
            }
          }
        }

        const report: Partial<IssueReport> = {}
        await Promise.all(rechecks.map(r => r(report)))
        this.report(report)
      } finally {
        this.commit('issuesEndResolve', unfixed)
      }
    } finally {
      this.release('diagnose')
    }
  }
}
