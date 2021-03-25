import { AUTHLIB_ORG_NAME } from '/@main/constant'
import { validateSha256 } from '/@main/util/fs'
import { IssueReport } from '/@shared/entities/issue'
import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { DownloadTask, installResolvedLibrariesTask } from '@xmcl/installer'
import { ensureFile, readJson, writeFile } from 'fs-extra'
import { join } from 'path'
import DiagnoseService from './DiagnoseService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import LauncherApp from '../app/LauncherApp'
import { ExternalAuthSkinServiceKey, ExternalAuthSkinService as IExternalAuthSkinService } from '/@shared/services/ExternalAuthSkinService'

@ExportService(ExternalAuthSkinServiceKey)
export default class ExternalAuthSkinService extends AbstractService implements IExternalAuthSkinService {
  constructor(
    app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)
    diagnoseService.registerMatchedFix(['missingAuthlibInjector'],
      () => this.installAuthlibInjection(),
      diagnoseService.diagnoseUser.bind(diagnoseService))

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
    this.diagnoseService.diagnoseUser(report)
    this.diagnoseService.report(report)

    return path
  }
}
