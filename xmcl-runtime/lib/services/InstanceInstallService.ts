import { checksum } from '@xmcl/core'
import { DownloadTask } from '@xmcl/installer'
import { InstallInstanceOptions, InstanceFile, InstanceInstallService as IInstanceInstallService, InstanceInstallServiceKey, InstanceIOException, LockKey, Persisted, Resource, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { AbortableTask, Task, task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream, existsSync } from 'fs'
import { readFile, rename, stat, unlink, writeFile } from 'fs-extra'
import { join, relative } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { CurseForgeService } from './CurseForgeService'
import { InstanceService } from './InstanceService'
import { ModrinthService } from './ModrinthService'
import { PeerService } from './PeerService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

type RequiredPick<T, K extends keyof T> = T & Required<Pick<T, K>>

export class ResolveInstanceFileTask extends AbortableTask<void> {
  private controller?: AbortController

  constructor(private files: InstanceFile[], private curseforgeService: CurseForgeService, private modrinthService: ModrinthService) {
    super()
    this.name = 'resolve'
  }

  protected async process(): Promise<void> {
    const curseforgeProjects = [] as RequiredPick<InstanceFile, 'curseforge'>[]
    const modrinthProjects = [] as RequiredPick<InstanceFile, 'modrinth'>[]
    const modrinthFileHashProjects = [] as InstanceFile[]
    for (const file of this.files) {
      if (file.curseforge) {
        curseforgeProjects.push(file as any)
      }

      if (file.modrinth) {
        modrinthProjects.push(file as any)
      }

      if (!file.modrinth && !file.curseforge) {
        modrinthFileHashProjects.push(file)
      }
    }

    const controller = new AbortController()
    this.controller = controller

    const processCurseforge = async () => {
      if (curseforgeProjects.length === 0) return
      const result = await this.curseforgeService.client.getFiles(curseforgeProjects.map(p => p.curseforge.fileId), controller.signal)
      for (const r of result) {
        const p = curseforgeProjects.find(p => p.curseforge.fileId === r.id)!
        if (!p.downloads) { p.downloads = [] }
        p.downloads.push(...(r.downloadUrl ? [r.downloadUrl] : guessCurseforgeFileUrl(r.id, r.fileName)))
      }
    }

    const processModrinth = async () => {
      if (modrinthProjects.length === 0) return
      const result = await this.modrinthService.client.getProjectVersionsById(modrinthProjects.map(v => v.modrinth.versionId), controller.signal)
      for (const r of result) {
        const p = modrinthProjects.find(p => p.modrinth.versionId === r.id)!
        if (!p.downloads) { p.downloads = [] }
        p.downloads.push(r.files[0].url)
      }
    }

    const processModrinthLike = async () => {
      if (modrinthFileHashProjects.length === 0) return
      const result = await this.modrinthService.client.getProjectVersionsByHash(modrinthFileHashProjects.filter(v => !!v.hashes.sha1).map(v => v.hashes.sha1), controller.signal)
      for (const r of Object.entries(result)) {
        const p = modrinthFileHashProjects.find(p => p.hashes.sha1 === r[0])!
        if (!p.downloads) { p.downloads = [] }
        if (p.downloads.indexOf(r[1].files[0].url) === -1) {
          p.downloads.push(r[1].files[0].url)
        }
        if (!p.modrinth) {
          p.modrinth = {
            projectId: r[1].project_id,
            versionId: r[1].id,
          }
        }
      }
    }

    await Promise.all([
      processCurseforge(),
      processModrinth(),
      processModrinthLike(),
    ])
  }

  protected abort(isCancelled: boolean): void {
    this.controller?.abort()
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}

class UnzipFileTask extends AbortableTask<void> {
  private stream: Readable | undefined

  constructor(private getEntry: Promise<readonly [ZipFile, Entry]>, private destination: string) {
    super()
  }

  protected async process(): Promise<void> {
    const [zip, entry] = await this.getEntry
    const stream = await openEntryReadStream(zip, entry)
    stream.on('data', (chunk) => {
      // @ts-ignore
      this._progress += chunk.length
    })
    this.stream = stream
    await pipeline(stream, createWriteStream(this.destination))
  }

  protected abort(isCancelled: boolean): void {
    this.stream?.destroy(new errors.RequestAbortedError())
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(PeerService) private peerService: PeerService,
    @Inject(CurseForgeService) private curseforgeService: CurseForgeService,
    @Inject(ModrinthService) private modrinthService: ModrinthService,
  ) {
    super(app)
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

    const { curseforgeService, modrinthService, writeInstallProfile } = this

    const zipBarrier = createPromiseSignal()
    const zips = new Set<string>()
    const zipInstances: Record<string, [ZipFile, Entry[]]> = {}
    const getEntry = async (file: string, entry: string) => {
      zips.add(file)
      await zipBarrier.promise
      const [instance, entries] = zipInstances[file]
      return [instance, entries.find(e => e.fileName === entry)!] as const
    }

    const getTask = (file: InstanceFile) => this.getDownloadFile(file, instancePath, getEntry)

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))

    const updateInstanceTask = task('installInstance', async function () {
      await lock.write(async () => {
        try {
          await this.yield(new ResolveInstanceFileTask(files, curseforgeService, modrinthService))
          await writeInstallProfile(instancePath, files)
        } catch {
          // Ignore
        }
        const tasks = await Promise.all(files.map(getTask)).then(v => v.filter(isNonnull))
        for (const zip of zips) {
          const zipInstance = await open(zip)
          zipInstances[zip] = [zipInstance, await readAllEntries(zipInstance)]
        }
        zipBarrier.resolve()
        await this.all(tasks, { throwErrorImmediately: false })
        Object.values(zipInstances).map(v => v[0].close())
      })
    }, { instance: instancePath })

    try {
      await this.submit(updateInstanceTask)
      await this.removeInstallProfile(instancePath)
    } catch (e) {
      this.error(`Fail to install instance ${options.path} \n%o`, e)
      await this.writeInstallProfile(instancePath, files)
      throw e
    }
  }

  async checkInstanceInstall() {
    const current = this.instanceService.state.path
    const profile = join(current, '.install-profile')
    if (existsSync(profile)) {
      const fileContent = JSON.parse(await readFile(profile, 'utf-8'))
      if (fileContent.lockVersion !== 0) {
        throw new Error(`Cannot identify lockfile version ${fileContent.lockVersion}`)
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

  private async getDownloadFile(file: InstanceFile, instancePath: string, getEntry: (zipFile: string, entry: string) => Promise<readonly [ZipFile, Entry]>) {
    const createFileLinkTask = (dest: string, res: Persisted<Resource>) => task('file', async () => {
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

    const createDownloadTask = (file: InstanceFile, destination: string, sha1?: string): Task<any> => {
      if (file.downloads) {
        const zip = file.downloads.find(u => u.startsWith('zip:'))
        const peerUrl = file.downloads.find(u => u.startsWith('peer://'))
        const hasHttp = file.downloads.some(u => u.startsWith('http'))
        if (peerUrl && !hasHttp) {
          // Download from peer
          this.log(`Download ${destination} from peer ${peerUrl}`)
          return this.peerService.createDownloadTask(peerUrl, destination, sha1 ?? '', file.size)
        } else if (hasHttp) {
          // HTTP download
          return new DownloadTask({
            ...this.networkManager.getDownloadBaseOptions(),
            url: file.downloads.filter(u => u.startsWith('http')),
            destination,
            validator: sha1
              ? {
                hash: sha1,
                algorithm: 'sha1',
              }
              : undefined,
          })
        } else if (zip) {
          // Unzip
          const url = zip.substring('zip:'.length)
          const zipPath = url.substring(0, url.length - file.path.length)
          const promise = getEntry(zipPath, file.path)
          return new UnzipFileTask(promise, destination)
        } else {
          throw new Error(`Cannot resolve file! ${file.path}`)
        }
      } else {
        throw new Error(`Cannot resolve file! ${file.path}`)
      }
    }

    const sha1 = file.hashes.sha1
    const filePath = join(instancePath, file.path)
    const actualSha1 = await checksum(filePath, 'sha1').catch(() => undefined)

    if (relative(instancePath, filePath).startsWith('..')) {
      return undefined
    }

    if (!!sha1 && actualSha1 === sha1) {
      // skip same file
      return undefined
    }

    const metadata: ResourceMetadata = {}
    if (file.curseforge) {
      metadata.curseforge = {
        fileId: file.curseforge.fileId,
        projectId: file.curseforge.projectId,
      }
    }

    if (file.modrinth) {
      metadata.modrinth = {
        versionId: file.modrinth.versionId,
        projectId: file.modrinth.projectId,
      }
    }

    const urls = [] as string[]

    if (file.downloads) {
      urls.push(...file.downloads)
    }

    const resource = this.resourceService.state.mods.find(r => r.hash === sha1) ||
      this.resourceService.state.resourcepacks.find(r => r.hash === sha1) ||
      this.resourceService.state.shaderpacks.find(r => r.hash === sha1)

    if (resource && await this.resourceService.validateResource(resource)) {
      if ((metadata.modrinth && !resource.metadata.modrinth) || (metadata.curseforge && resource.metadata.curseforge) || (urls.length > 0 && urls.some(u => resource.uri.indexOf(u) === -1))) {
        await this.resourceService.updateResource({ hash: resource.hash, metadata, uri: urls }).catch((e) => {
          this.warn(`Fail to update existed resource ${resource.name}(${resource.hash}) metadata during instance install:`)
          this.warn(e)
        })
      }
      return createFileLinkTask(filePath, resource)
    }

    const pending = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
    const destination = pending ? `${filePath}.pending` : filePath

    return createDownloadTask(file, destination, sha1).setName('file').map(async () => {
      if (pending) {
        // Most be cache
        await this.resourceService.importResource({
          background: true,
          resources: [{
            path: destination,
            domain: file.path.startsWith(ResourceDomain.Mods)
              ? ResourceDomain.Mods
              : file.path.startsWith(ResourceDomain.ResourcePacks)
                ? ResourceDomain.ResourcePacks
                : ResourceDomain.ShaderPacks,
            metadata,
          }],
        }).catch(e => {
          if (Object.keys(metadata).length > 0) {
            this.log(`Fallback to mark resource ${destination} ${sha1}\n%o`, e)
            this.resourceService.markResourceMetadata(sha1, metadata)
          }
        })
        try {
          await rename(destination, destination.substring(0, destination.length - '.pending'.length))
        } catch (e) {
          this.error(`Fail to rename ${destination} -> ${destination.substring(0, destination.length - '.pending'.length)} \n%o`, e)
          throw e
        }
      }
      return undefined
    })
  }
}
