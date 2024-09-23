import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceInstallService as IInstanceInstallService, InstallInstanceOptions, InstanceFile, InstanceInstallServiceKey, LockKey } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { existsSync } from 'fs'
import { readFile, unlink } from 'fs-extra'
import { join } from 'path'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ResourceService, ResourceWorker, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { AnyError } from '../util/error'
import { InstanceFileOperationHandler } from './InstanceFileOperationHandler'
import { ResolveInstanceFileTask } from './ResolveInstanceFileTask'
import { removeInstallProfile, writeInstallProfile } from './instanceInstall'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kTaskExecutor) private submit: TaskFn,
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
      id,
    } = options

    await writeInstallProfile(instancePath, files)

    const curseforgeClient = this.curseforgeClient
    const modrinthClient = this.modrinthClient
    const resourceService = this.resourceService

    const handler = new InstanceFileOperationHandler(
      this.app,
      resourceService,
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
        const tasks = await handler.process(files)
        await this.all(tasks, { throwErrorImmediately: false })
        await handler.postprocess(modrinthClient)
      })
    }, { instance: instancePath, id })

    try {
      await this.submit(updateInstanceTask)
      await removeInstallProfile(instancePath)
    } catch (e) {
      const unfinished = files.filter(f => !handler.finished.has(f))
      await writeInstallProfile(instancePath, unfinished)
      throw Object.assign(e as any, {
        name: (e as any).name === 'Error' ? 'InstallInstanceFilesError' : (e as any).name,
        installInstance: {
          instancePath,
        },
      })
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
