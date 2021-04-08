import { DownloadTask } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { readFile, writeFile } from 'atomically'
import { readdir, stat, unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { InstallHMCLModpackTask, resolveHMCLVersion } from '../entities/hmclModpack'
import InstanceService from './InstanceService'
import AbstractService, { ExportService, Inject, Singleton, Subscribe } from './Service'
import { FileInfo, HMCLServerManagedModpack } from '/@shared/entities/hmclModpack'
import { ImportHMCLModpackOptions, InstanceHMCLModpackService as IInstanceHMCLModpackService, InstanceHMCLModpackServiceKey } from '/@shared/services/InstanceHMCLModpackService'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExportService(InstanceHMCLModpackServiceKey)
export default class InstanceHMCLModpackService extends AbstractService implements IInstanceHMCLModpackService {
  private currentInstance = ''

  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app)
    this.storeManager.subscribe('instanceSelect', async (path) => {
      const serverManifest = this.getPath(path, 'server-manfiest.json')
      try {
        const manifest: HMCLServerManagedModpack = await readFile(serverManifest).then(b => JSON.parse(b.toString()))
        this.commit('hmclModpackSet', manifest)
        this.currentInstance = path
        this.log(`Instance ${path} is managed by HMCL modpack`)
      } catch (e) {
        if (e.code !== 'ENOENT') {
          this.warn(`Cannot parse server-manifest.json at ${serverManifest}`)
          this.warn(e)
        }
      }
    })
  }

  async importHMCLModpack(options: ImportHMCLModpackOptions): Promise<string> {
    const instancePath = await this.instanceService.createInstance({})
    const task = new InstallHMCLModpackTask(options.path, instancePath)
    const modpack = await this.submit(task)
    await this.instanceService.editInstance({
      instancePath,
      name: modpack.name,
      author: modpack.author,
      description: modpack.description,
    })
    const serverManifest = this.getPath(this.currentInstance, 'server-manfiest.json')
    await writeFile(serverManifest, JSON.stringify(modpack))
    return instancePath
  }

  @Singleton()
  async refresh(): Promise<void> {
    const current = this.state.instanceHCMLModpack.current
    if (current) {
      const newContent: HMCLServerManagedModpack = await this.networkManager.request(`${current.fileApi}/${current}`).json()
      if (newContent.version !== current.version) {
        this.commit('hmclModpackPending', newContent)
      }
    }
  }

  @Singleton()
  async updateModpack(): Promise<void> {
    const root = this.currentInstance

    if (!this.state.instanceHCMLModpack.pending || !this.state.instanceHCMLModpack.current) {
      throw new Error()
    }

    const current = this.state.instanceHCMLModpack.current
    const pending = this.state.instanceHCMLModpack.pending

    const fullMode = pending.update === 'full'

    const oldFileTree: Record<string, FileInfo | undefined> = {}
    for (const file of current.files) {
      oldFileTree[file.path] = file
    }
    const newFileTree: Record<string, FileInfo | undefined> = {}
    for (const file of pending.files) {
      newFileTree[file.path] = file
    }
    const realFileTree: Record<string, FileInfo> = {}
    const worker = this.worker()
    const options = this.networkManager.getDownloadBaseOptions()

    await this.submit(task('updateHMCLModpack', async function () {
      const discover = async (relativePath: string) => {
        const fullPath = join(root, relativePath)
        const fileStat = await stat(fullPath)
        if (fileStat.isDirectory()) {
          const files = await readdir(fullPath)
          for (const child of files) {
            await discover(join(relativePath, child))
          }
        } else {
          const sha1 = await worker.checksum({ path: fullPath, algorithm: 'sha1' })
          if (relativePath !== 'instance.json') {
            realFileTree[relativePath] = { path: relativePath, hash: sha1 }
          }
        }
      }
      await discover('.')

      const allFiles = new Set([...Object.keys(oldFileTree), ...Object.keys(newFileTree), ...Object.keys(realFileTree)])
      const promises: Promise<any>[] = []
      if (!fullMode) {
        for (const file of allFiles) {
          if (oldFileTree[file]) {
            if (newFileTree[file]) {
              if (!realFileTree[file]) {
                // noop
              } else if (realFileTree[file].hash !== oldFileTree[file]!.hash) {
                // noop
              } else {
                if (newFileTree[file]!.hash !== realFileTree[file].hash) {
                  promises.push(this.yield(new DownloadTask({
                    url: `${pending.fileApi}/${file}`,
                    destination: join(root, file),
                    ...options,
                  })))
                }
              }
            } else {
              if (realFileTree[file]) {
                promises.push(unlink(join(root, file)))
              }
            }
          } else {
            if (newFileTree[file]) {
              if (!realFileTree[file] || realFileTree[file].hash !== newFileTree[file]!.hash) {
                // no such file or file is different
                promises.push(this.yield(new DownloadTask({
                  url: `${pending.fileApi}/${file}`,
                  destination: join(root, file),
                  ...options,
                })))
              }
            }
          }
        }
      } else {
        for (const file of Object.keys(newFileTree)) {
          if (!realFileTree[file] || realFileTree[file].hash !== newFileTree[file]!.hash) {
            promises.push(this.yield(new DownloadTask({
              url: `${pending.fileApi}/${file}`,
              destination: join(root, file),
              ...options,
            })))
          }
        }
        const handledFiles = new Set(Object.keys(newFileTree))
        for (const file of Object.keys(realFileTree).filter(f => !handledFiles.has(f))) {
          promises.push(unlink(join(root, file)))
        }
      }
      await Promise.all(promises)
    }))

    this.commit('hmclModpackPending', undefined)
    this.commit('hmclModpackSet', pending)
    const serverManifest = this.getPath(this.currentInstance, 'server-manfiest.json')
    await writeFile(serverManifest, JSON.stringify(pending))
  }
}
