import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceInstallService as IInstanceInstallService, InstallInstanceOptions, InstanceFile, InstanceInstallServiceKey, LockKey } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { existsSync } from 'fs'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { FileDownloadHandler, ResolveInstanceFileTask, postprocess, removeInstallProfile, writeInstallProfile } from '../entities/instanceInstall'
import { ResourceWorker, kResourceWorker } from '../entities/resourceWorker'
import { AnyError } from '../util/error'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(CurseforgeV1Client) private curseforgeClient: CurseforgeV1Client,
    @Inject(ModrinthV2Client) private modrinthClient: ModrinthV2Client,
  ) {
    super(app)
  }

  async installInstanceFiles(options: InstallInstanceOptions): Promise<void> {
    const {
      path: instancePath,
      files,
    } = options

    await writeInstallProfile(instancePath, files)

    const curseforgeClient = this.curseforgeClient
    const modrinthClient = this.modrinthClient
    const resourceService = this.resourceService

    const handler = new FileDownloadHandler(
      this.app,
      this.resourceService,
      this.worker,
      this,
      instancePath,
    )

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))

    const updateInstanceTask = task('installInstance', async function () {
      await lock.write(async () => {
        try {
          await this.yield(new ResolveInstanceFileTask(files, curseforgeClient, modrinthClient))
          await writeInstallProfile(instancePath, files)
        } catch {
          // Ignore
        }
        const tasks = await Promise.all(files.map(f => handler.getTask(f))).then(v => v.filter(isNonnull))
        await handler.process()
        const results = await this.all(tasks, { throwErrorImmediately: false })
        await postprocess(modrinthClient, resourceService, results)
        handler.dispose()
      })
    }, { instance: instancePath })

    try {
      await this.submit(updateInstanceTask)
      await removeInstallProfile(instancePath)
    } catch (e) {
      await writeInstallProfile(instancePath, files)
      throw new AnyError('InstallInstanceFilesError', `Fail to install instance ${instancePath}`, { cause: e })
    }
  }

  async checkInstanceInstall(path: string) {
    const profile = join(path, '.install-profile')
    if (existsSync(profile)) {
      try {
        const fileContent = JSON.parse(await readFile(profile, 'utf-8'))
        if (fileContent.lockVersion !== 0) {
          throw new AnyError('InstanceFileError', `Cannot identify lockfile version ${fileContent.lockVersion}`)
        }
        const files = fileContent.files as InstanceFile[]
        return files
      } catch (e) {
        if (e instanceof SyntaxError) {
          this.error(new AnyError('InstanceFileError', `Fail to parse instance install profile ${profile} as syntex error`, { cause: e }))
          await unlink(profile).catch(() => undefined)
        } else {
          throw e
        }
      }
    }
    return []
  }
}
