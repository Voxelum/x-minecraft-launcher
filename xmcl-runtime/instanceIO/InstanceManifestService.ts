import { CurseforgeV1Client } from '@xmcl/curseforge'
import { generateInstanceManifest, getInstanceFiles, type InstanceFile } from '@xmcl/instance'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { ResourceManager } from '@xmcl/resource'
import { InstanceIOException, InstanceManifestServiceKey, type GetManifestOptions, type InstanceManifestService as IInstanceManifestService, type InstanceManifest } from '@xmcl/runtime-api'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { InstanceService } from '~/instance'
import { kResourceWorker, kResourceManager } from '~/resource'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { ResolveInstanceFileTask } from './utils/ResolveInstanceFileTask'

@ExposeServiceKey(InstanceManifestServiceKey)
export class InstanceManifestService extends AbstractService implements IInstanceManifestService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
  ) {
    super(app)
  }

  @Singleton(p => JSON.stringify(p))
  async getInstanceServerManifest(options: GetManifestOptions): Promise<Array<InstanceFile>> {
    const instancePath = options?.path

    const instanceService = await this.app.registry.get(InstanceService)

    const instance = instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    let files = [] as Array<InstanceFile>

    const fileWithStats = await getInstanceFiles(join(instancePath, 'server'), this, (filePath) => {
      if (filePath.startsWith('libraries') || filePath.startsWith('versions') || filePath.startsWith('assets')) {
        return true
      }
      if (filePath.endsWith('.DS_Store') || filePath.endsWith('.gitignore')) {
        return true
      }
      return false
    })

    files = fileWithStats.map(([file]) => file)

    return files
  }

  @Singleton(p => JSON.stringify(p))
  async getInstanceManifest(options: GetManifestOptions): Promise<InstanceManifest> {
    const instancePath = options?.path

    const instanceService = await this.app.registry.get(InstanceService)

    const instance = instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    const worker = await this.app.registry.get(kResourceWorker)
    const manager = await this.app.registry.get(kResourceManager)

    const undecorated = new Set<InstanceFile>()
    const result = await generateInstanceManifest(options, instance, worker, manager, this, undecorated)

    const resolveTask = new ResolveInstanceFileTask(
      undecorated,
      await this.app.registry.get(CurseforgeV1Client),
      await this.app.registry.get(ModrinthV2Client),
    )
    await resolveTask.startAndWait()

    return result
  }
}
