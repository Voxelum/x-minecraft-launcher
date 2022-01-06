import { InstanceShaderPacksService as IInstanceShaderPacksServic, InstanceShaderPacksServiceKey, isPersistedResource, isShaderPackResource, ResourceDomain } from '@xmcl/runtime-api'
import { lstat, readdir, readlink, remove, unlink } from 'fs-extra'
import { join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { isSystemError } from '../util/error'
import { createSymbolicLink, ENOENT_ERROR } from '../util/fs'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton, Subscribe } from './Service'

@ExportService(InstanceShaderPacksServiceKey)
export default class InstanceShaderPacksService extends AbstractService implements IInstanceShaderPacksServic {
  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app)
  }

  @Subscribe('instanceSelect')
  protected async onInstance(payload: string) {
    this.link(payload)
  }

  @Singleton()
  async link(instancePath: string = this.instanceService.state.path) {
    const destPath = join(instancePath, 'shaderpacks')
    const srcPath = this.getPath('shaderpacks')
    const stat = await lstat(destPath).catch((e) => {
      if (isSystemError(e) && e.code === ENOENT_ERROR) {
        return
      }
      throw e
    })

    await this.resourceService.whenReady(ResourceDomain.ShaderPacks)
    this.log(`Linking the shaderpacks at domain to ${instancePath}`)
    if (stat) {
      if (stat.isSymbolicLink()) {
        if (await readlink(destPath) === srcPath) {
          this.log(`Skip linking the shaderpacks at domain as it already linked: ${instancePath}`)
          return
        }
        this.log(`Relink the shaderpacks domain: ${instancePath}`)
        await unlink(destPath)
      } else {
        // Import all directory content
        if (stat.isDirectory()) {
          const files = await readdir(destPath)

          this.log(`Import shaderpacks directories while linking: ${instancePath}`)
          await Promise.all(files.map(f => join(destPath, f)).map(async (filePath) => {
            const [resource, icon] = await this.resourceService.resolveResource({ path: filePath, type: 'shaderpacks' })
            if (isShaderPackResource(resource)) {
              this.log(`Add shader pack ${filePath}`)
            } else {
              this.warn(`Non shader pack resource added in /shaderpacks directory! ${filePath}`)
            }
            if (!isPersistedResource(resource)) {
              await this.resourceService.importParsedResource({ path: filePath }, resource, icon).catch((e) => {
                this.emit('error', {})
                this.warn(e)
              })
              this.log(`Found new resource in /shaderpacks directory! ${filePath}`)
            }
          }))

          await remove(destPath)
        } else {
          // TODO: handle this case
          throw new Error()
        }
      }
    }

    await createSymbolicLink(srcPath, destPath)
  }

  async showDirectory(): Promise<void> {
    await this.app.openDirectory(join(this.instanceService.state.path, 'shaderpacks'))
  }
}
