import { InstanceShaderPacksService as IInstanceShaderPacksServic, InstanceShaderPacksServiceKey, LockKey, ResourceDomain } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir } from 'fs-extra'
import { basename, join } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { tryLink } from '../util/linkResourceFolder'

@ExposeServiceKey(InstanceShaderPacksServiceKey)
export class InstanceShaderPacksService extends AbstractService implements IInstanceShaderPacksServic {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app)
  }

  @Lock(p => LockKey.shaderpacks(p))
  async install(instancePath: string, shaderPackFilePath: string) {
    const fileName = basename(shaderPackFilePath)
    const src = this.getPath(ResourceDomain.ShaderPacks, fileName)
    const dest = join(instancePath, ResourceDomain.ShaderPacks, fileName)
    if (!existsSync(dest)) {
      throw Object.assign(new Error(), { name: 'FileNotFound' })
    }
    await linkWithTimeoutOrCopy(src, dest)
    return true
  }

  @Lock(p => LockKey.shaderpacks(p))
  async scan(instancePath: string) {
    const destPath = join(instancePath, 'shaderpacks')
    const files = await readdir(destPath).catch(() => [])

    this.log(`Import shaderpacks directories while linking: ${instancePath}`)
    const resources = await this.resourceService.importResources(files.map(f => ({ path: join(destPath, f), domain: ResourceDomain.ShaderPacks })))
    this.log(`Import ${resources.length} shaderpacks.`)

    return resources
  }

  @Lock(p => LockKey.shaderpacks(p))
  async link(instancePath: string) {
    if (!instancePath) return false
    const destPath = join(instancePath, 'shaderpacks')
    const srcPath = this.getPath('shaderpacks')
    await this.resourceService.whenReady(ResourceDomain.ShaderPacks)

    try {
      const isLinked = await tryLink(srcPath, destPath, this, (path) => this.instanceService.isUnderManaged(path))
      return isLinked
    } catch (e) {
      this.error(new AnyError('LinkShaderPacksError', `Fail to link shaderpacks folder under: "${instancePath}"`, { cause: e }))
      return false
    }
  }

  async showDirectory(instancePath: string): Promise<void> {
    await this.app.shell.openDirectory(join(instancePath, 'shaderpacks'))
  }
}
