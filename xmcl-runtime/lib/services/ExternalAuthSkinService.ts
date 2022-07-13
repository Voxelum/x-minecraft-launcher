import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { DownloadTask, installResolvedLibrariesTask } from '@xmcl/installer'
import { ExternalAuthSkinService as IExternalAuthSkinService, ExternalAuthSkinServiceKey, IssueReport, IssueReportBuilder, MissingAuthLibInjectorIssue } from '@xmcl/runtime-api'
import { ensureFile, readJson, writeFile } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { validateSha256 } from '../util/fs'
import { DiagnoseService } from './DiagnoseService'
import { ResourceService } from './ResourceService'
import { AbstractService, Inject, Singleton } from './Service'
import { UserService } from './UserService'

const AUTHLIB_ORG_NAME = 'org.to2mbn:authlibinjector'

/**
 * Majorly support the third party skin using authlib injector
 */
export class ExternalAuthSkinService extends AbstractService implements IExternalAuthSkinService {
  constructor(
    app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(UserService) private userService: UserService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, ExternalAuthSkinServiceKey)
    diagnoseService.register(
      {
        id: MissingAuthLibInjectorIssue,
        fix: async () => { await this.installAuthLibInjection() },
      })

    this.storeManager.subscribeAll(['userGameProfileSelect', 'userProfileUpdate', 'userSnapshot'], async () => {
      const builder = new IssueReportBuilder()
      this.diagnoseAuthLibInjector(builder)
      this.diagnoseService.report(builder.build())
    })
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
    return this.resourceService.importResource({
      path: destination,
      type: 'mods',
    })
  }

  async installAuthLibInjection(): Promise<string> {
    const jsonPath = this.getPath('authlib-injection.json')
    const root = this.getPath()
    const mc = new MinecraftFolder(root)

    const download = async (content: any) => {
      const name = `${AUTHLIB_ORG_NAME}:${content.version}`
      const info = LibraryInfo.resolve(name)
      const path = mc.getLibraryByPath(info.path)

      await this.submit(new DownloadTask({
        url: content.download_url,
        validator: {
          algorithm: 'sha256',
          hash: content.checksums.sha256,
        },
        destination: path,
      }))
      return path
    }

    let path: string

    try {
      const body = await this.networkManager.request('https://authlib-injector.yushi.moe/artifact/latest.json').json()
      await writeFile(jsonPath, JSON.stringify(body))
      path = await download(body)
    } catch (e) {
      const content = await readJson(jsonPath).catch(() => undefined)
      if (content) {
        path = await download(content)
      } else {
        throw e
      }
    }

    const builder = new IssueReportBuilder()
    this.diagnoseAuthLibInjector(builder)
    this.diagnoseService.report(builder.build())

    return path
  }

  @Singleton()
  async diagnoseAuthLibInjector(builder: IssueReportBuilder) {
    this.up('diagnose')
    builder.set(MissingAuthLibInjectorIssue)
    const doesAuthLibInjectionExisted = async () => {
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
        if (this.userService.state.isThirdPartyAuthentication) {
          if (!await doesAuthLibInjectionExisted()) {
            builder.set(MissingAuthLibInjectorIssue, undefined)
          }
        }
      }
    } finally {
      this.down('diagnose')
    }
  }
}
