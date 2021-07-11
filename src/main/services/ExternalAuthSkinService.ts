import { AUTHLIB_ORG_NAME } from '/@main/constant'
import { validateSha256 } from '/@main/util/fs'
import { IssueReport } from '/@shared/entities/issue'
import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { DownloadTask, installResolvedLibrariesTask } from '@xmcl/installer'
import { ensureFile, readJson, writeFile } from 'fs-extra'
import { join } from 'path'
import DiagnoseService from './DiagnoseService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton, Subscribe } from './Service'
import LauncherApp from '../app/LauncherApp'
import { ExternalAuthSkinServiceKey, ExternalAuthSkinService as IExternalAuthSkinService } from '/@shared/services/ExternalAuthSkinService'
import UserService from './UserService'
import { compareRelease } from '/@shared/entities/version'

@ExportService(ExternalAuthSkinServiceKey)
export default class ExternalAuthSkinService extends AbstractService implements IExternalAuthSkinService {
  constructor(
    app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(UserService) private userService: UserService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)
    diagnoseService.registerMatchedFix(['missingAuthlibInjector'],
      () => this.installAuthlibInjection(),
      this.diagnoseAuthlibInjector.bind(this))

    // diagnoseService.registerMatchedFix(['missingCustomSkinLoader'],
    //   async ([issue]) => {
    //     const { target, missingJar } = issue.arguments
    //     const instance = this.getters.instance
    //     const { fabricLoader, forge, minecraft } = instance.runtime
    //     if (target === 'forge') {
    //       if (!forge) {
    //         const forges = this.state.version.forge.find(f => f.mcversion === minecraft)
    //         if (forges) {
    //           const version = forges.versions.find(v => v.type === 'latest') ?? forges.versions.find(v => v.type === 'common')
    //           if (version) {
    //             await this.instanceService.editInstance({ runtime: { forge: version?.version ?? '' } })
    //           }
    //         }
    //       }
    //       if (missingJar) {
    //         let resource = this.state.resource.mods.find((r) => r.type === 'forge' && (r.metadata as any)[0].modid === 'customskinloader')
    //         if (!resource) {
    //           resource = await this.externalAuthSkinService.downloadCustomSkinLoader('forge') as any
    //         }
    //         if (!resource) {
    //           throw new Error('Cannot find custom skin loader event we try to download it!')
    //         }
    //         await this.instanceResourceService.deploy({ resources: [resource] })
    //       }
    //     } else {
    //       if (!fabricLoader) {
    //         const loader = this.state.version.fabric.loaders[0]?.version ?? ''
    //         const yarn = this.state.version.fabric.yarns.find(y => y.gameVersion === 'minecraft')?.version ?? ''
    //         const runtime = { yarn, fabricLoader: loader }
    //         await this.instanceService.editInstance({ runtime })
    //       }
    //       if (missingJar) {
    //         const resource = this.state.resource.mods.find((r) => r.type === 'fabric' && (r.metadata as any).id === 'customskinloader')
    //         if (!resource) {
    //           await this.externalAuthSkinService.downloadCustomSkinLoader('fabric')
    //         }
    //         if (!resource) {
    //           throw new Error('Cannot find custom skin loader event we try to download it!')
    //         }
    //         await this.instanceResourceService.deploy({ resources: [resource] })
    //       }
    //     }
    //   },
    //   diagnoseService.diagnoseCustomSkin.bind(diagnoseService))
  }

  async downloadCustomSkinLoader(type: 'forge' | 'fabric' = 'forge') {
    const url = type === 'forge'
      ? 'https://github.com/xfl03/MCCustomSkinLoader/releases/download/14.12/CustomSkinLoader_Forge-14.12.jar'
      : 'https://github.com/xfl03/MCCustomSkinLoader/releases/download/14.12/CustomSkinLoader_Fabric-14.12.jar'
    const destination = type === 'forge'
      ? join(this.app.temporaryPath, 'CustomSkinLoader_Forge-14.12.jar')
      : join(this.app.temporaryPath, 'CustomSkinLoader_Fabric-14.12.jar')
    await ensureFile(destination)
    await this.submit(new DownloadTask({
      url,
      destination,
    }).setName('downloadCustomSkinLoader'))
    return this.resourceService.importFile({
      path: destination,
      type: 'mods',
    })
  }

  async installAuthlibInjection(): Promise<string> {
    const jsonPath = this.getPath('authlib-injection.json')
    const root = this.getPath()
    const mc = new MinecraftFolder(root)

    const download = async (content: any) => {
      const name = `${AUTHLIB_ORG_NAME}:${content.version}`
      const info = LibraryInfo.resolve(name)
      const authlib: Version.Library = {
        name,
        downloads: {
          artifact: {
            sha1: '',
            size: -1,
            path: info.path,
            url: content.download_url,
          },
        },
      }
      await this.submit(installResolvedLibrariesTask(Version.resolveLibraries([authlib]), root).setName('installAuthlibInjector'))
      return mc.getLibraryByPath(info.path)
    }

    const content = await readJson(jsonPath).catch(() => undefined)
    let path: string
    if (!content) {
      const body = await this.networkManager.request('https://authlib-injector.yushi.moe/artifact/latest.json').json()
      await writeFile(jsonPath, JSON.stringify(body))
      path = await download(body)
    } else {
      const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`)
      const libPath = mc.getLibraryByPath(info.path)
      if (await validateSha256(libPath, content.checksums.sha256)) {
        path = libPath
      } else {
        path = await download(content)
      }
    }

    const report: Partial<IssueReport> = {}
    this.diagnoseAuthlibInjector(report)
    this.diagnoseService.report(report)

    return path
  }

  @Subscribe('userGameProfileSelect', 'userProfileUpdate', 'userSnapshot')
  async onUserUpdate() {
    const report: Partial<IssueReport> = {}
    await this.diagnoseAuthlibInjector(report)
    this.diagnoseService.report(report)
  }

  @Singleton()
  async diagnoseAuthlibInjector(report: Partial<IssueReport>) {
    this.up('diagnose')
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
      const user = this.userService.state.users[this.userService.state.selectedUser.id]

      if (user) {
        this.log(`Diagnose user ${user.username}`)
        const tree: Pick<IssueReport, 'missingAuthlibInjector'> = {
          missingAuthlibInjector: [],
        }

        if (this.userService.state.isThirdPartyAuthentication) {
          if (!await doesAuthlibInjectionExisted()) {
            tree.missingAuthlibInjector.push({})
          }
        }
        Object.assign(report, tree)
      }
    } finally {
      this.down('diagnose')
    }
  }

  // @Singleton()
  // async diagnoseCustomSkin(report: Partial<IssueReport>) {
  //   this.aquire('diagnose')
  //   try {
  //     const user = this.state.user.users[this.state.user.selectedUser.id]
  //     const tree: Pick<IssueReport, 'missingCustomSkinLoader'> = {
  //       missingCustomSkinLoader: [],
  //     }
  //     if (user) {
  //       if (user.profileService !== 'mojang') {
  //         const instance = this.state.instance.all[this.state.instance.path]
  //         const { minecraft, fabricLoader, forge } = instance.runtime
  //         if ((!forge && !fabricLoader) || forge) {
  //           if (compareRelease(minecraft, '1.8.9') >= 0) {
  //             // use forge by default
  //             const res = this.state.instanceResource.mods.find((r) => r.type === 'forge' && (r.metadata as any)[0].modid === 'customskinloader')
  //             if (!res || !forge) {
  //               tree.missingCustomSkinLoader.push({
  //                 target: 'forge',
  //                 skinService: user.profileService,
  //                 missingJar: !res,
  //                 noVersionSelected: !forge,
  //               })
  //             }
  //           } else {
  //             this.warn('Current support on custom skin loader forge does not support version below 1.8.9!')
  //           }
  //         } else if (compareRelease(minecraft, '1.14') >= 0) {
  //           const res = this.state.instanceResource.mods.find((r) => r.type === 'fabric' && (r.metadata as any).id === 'customskinloader')
  //           if (!res) {
  //             tree.missingCustomSkinLoader.push({
  //               target: 'fabric',
  //               skinService: user.profileService,
  //               missingJar: true,
  //               noVersionSelected: false,
  //             })
  //           }
  //         } else {
  //           this.warn('Current support on custom skin loader fabric does not support version below 1.14!')
  //         }
  //       }
  //     }

  //     Object.assign(report, tree)
  //   } finally {
  //     this.release('diagnose')
  //   }
  // }
}
