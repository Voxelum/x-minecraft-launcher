import { checksum } from '@xmcl/core'
import { DownloadTask } from '@xmcl/installer'
import { InstallInstanceOptions, InstanceFile, InstanceInstallService as IInstanceInstallService, InstanceInstallServiceKey, InstanceIOException, InstanceIOServiceKey, LockKey, Persisted, Resource, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { Task, task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream, existsSync } from 'fs'
import { readFile, rename, stat, unlink, writeFile } from 'fs-extra'
import { join, relative } from 'path'
import { pipeline } from 'stream/promises'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { CurseForgeService } from './CurseForgeService'
import { InstanceService } from './InstanceService'
import { ModrinthService } from './ModrinthService'
import { PeerService } from './PeerService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(PeerService) private peerService: PeerService,
    @Inject(CurseForgeService) private curseForgeService: CurseForgeService,
    @Inject(ModrinthService) private modrinthService: ModrinthService,
  ) {
    super(app, InstanceInstallServiceKey)
  }

  async getInstanceDiff() {

  }

  @Singleton((o) => o.path)
  async installInstanceFiles(options: InstallInstanceOptions): Promise<void> {
    const {
      path,
      files,
    } = options

    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    await this.writeInstallProfile(instancePath, files)

    const { log, warn, error, peerService, resourceService, networkManager, curseForgeService, modrinthService } = this

    const zipBarrier = createPromiseSignal()
    const zips = new Set<string>()
    const zipInstances: Record<string, [ZipFile, Entry[]]> = {}
    const createDownloadTask = (file: InstanceFile, destination: string, sha1: string) => {
      if (file.downloads) {
        const zip = file.downloads.find(u => u.startsWith('zip:'))
        const peerUrl = file.downloads.find(u => u.startsWith('peer://'))
        const hasHttp = file.downloads.some(u => u.startsWith('http'))
        if (peerUrl && !hasHttp) {
          // Download from peer
          log(`Download ${destination} from peer ${peerUrl}`)
          return peerService.downloadTask(peerUrl, destination, sha1, file.size)
        } else if (hasHttp) {
          // HTTP download
          return new DownloadTask({
            ...networkManager.getDownloadBaseOptions(),
            url: file.downloads.filter(u => u.startsWith('http')),
            destination,
            validator: {
              hash: sha1,
              algorithm: 'sha1',
            },
          })
        } else if (zip) {
          // Unzip
          const url = zip.substring('zip:'.length)
          const zipPath = url.substring(0, url.length - file.path.length)
          zips.add(zipPath)
          return task('file', async function () {
            await zipBarrier.promise
            const [zip, entries] = openedZip[zipPath]
            const stream = await openEntryReadStream(zip, entries.find(e => e.fileName === file.path)!)
            stream.on('data', (chunk) => {
              // @ts-ignore
              this._progress += chunk.length
            })
            await pipeline(stream, createWriteStream(destination))
          })
        } else {
          throw new Error(`Cannot resolve file! ${file.path}`)
        }
      } else {
        // no
        throw new Error(`Cannot resolve file! ${file.path}`)
      }
    }

    const createFileLinkTask = (dest: string, res: Persisted<Resource>) => {
      return task('file', async () => {
        const fstat = await stat(dest).catch(() => undefined)
        if (fstat && fstat.ino === res.ino) {
          return
        }
        if (fstat) {
          // existed file
          await unlink(dest)
        }
        await linkWithTimeoutOrCopy(res.path, dest)
      })
    }

    const openedZip: Record<string, [ZipFile, Entry[]]> = {}

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))

    const updateInstanceTask = task('installInstance', async function () {
      await lock.write(async () => {
        const tasks: Task<any>[] = []
        for (const file of files) {
          const sha1 = file.hashes.sha1
          const filePath = join(instancePath, file.path)
          const actualSha1 = await checksum(filePath, 'sha1').catch(() => undefined)

          if (relative(instancePath, filePath).startsWith('..')) {
            warn(`Skip to install the escaped file ${filePath}`)
            continue
          }

          if (actualSha1 === sha1) {
            // skip same file
            log(`Skip to update the file ${file.path} as the sha1 is matched`)
            continue
          }

          const resource = resourceService.state.mods.find(r => r.hash === sha1) || resourceService.state.resourcepacks.find(r => r.hash === sha1) ||
            resourceService.state.shaderpacks.find(r => r.hash === sha1)
          if (resource) {
            log(`Link existed resource to ${filePath}`)
            tasks.push(createFileLinkTask(filePath, resource))
          } else {
            const urls = [] as string[]
            const metadata: ResourceMetadata = {}

            if (file.curseforge) {
              const fileInfo = await curseForgeService.fetchProjectFile(file.curseforge.projectId, file.curseforge.fileId)

              if (fileInfo.downloadUrl) {
                urls.unshift(fileInfo.downloadUrl)
              } else {
                urls.push(...guessCurseforgeFileUrl(fileInfo.id, fileInfo.fileName))
              }

              metadata.curseforge = {
                fileId: file.curseforge.fileId,
                projectId: file.curseforge.projectId,
              }
            }

            if (file.modrinth) {
              const version = await modrinthService.getProjectVersion(file.modrinth.versionId)
              metadata.modrinth = {
                filename: version.files[0].filename,
                versionId: file.modrinth.versionId,
                projectId: file.modrinth.projectId,
                url: version.files[0].url,
              }
              urls.unshift(version.files[0].url)
            }

            if (Object.keys(metadata).length > 0) {
              resourceService.markResourceMetadata(sha1, metadata)
            }

            const pending = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
            const destination = pending ? `${filePath}.pending` : filePath

            log(`Download ${filePath} from urls: [${urls.join(', ')}]`)
            const task = createDownloadTask(file, destination, sha1).setName('file').map(async () => {
              if (pending) {
                await rename(destination, destination.substring(0, destination.length - '.pending'.length))
              }
              return undefined
            })
            tasks.push(task)
          }
        }
        for (const zip of zips) {
          const zipInstance = await open(zip)
          zipInstances[zip] = [zipInstance, await readAllEntries(zipInstance)]
        }
        zipBarrier.resolve()
        await this.all(tasks)
      })
    }, { instance: instancePath })

    await this.submit(updateInstanceTask)
    await this.removeInstallProfile(instancePath)
  }

  async checkInstanceInstall() {
    const current = this.instanceService.state.path
    const profile = join(current, '.install-profile')
    if (existsSync(profile)) {
      const fileContent = JSON.parse(await readFile(profile, 'utf-8'))
      if (fileContent.version !== 0) {
        throw new Error(`Cannot identify lockfile version ${fileContent.version}`)
      }
      const files = fileContent.files as InstanceFile[]
      return files
    }
    return []
  }

  private async writeInstallProfile(path: string, files: InstanceFile[]) {
    const filePath = join(path, '.install-profile')
    const content = {
      lockVersion: 0,
      files,
    }
    await writeFile(filePath, JSON.stringify(content, null, 4))
  }

  private async removeInstallProfile(path: string) {
    const filePath = join(path, '.install-profile')
    await unlink(filePath)
  }
}
