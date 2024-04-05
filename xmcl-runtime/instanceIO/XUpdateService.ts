import { checksum } from '@xmcl/core'
import { XUpdateService as IXUpdateService, InstanceFile, InstanceIOException, InstanceManifest, InstanceUpdate, SetInstanceManifestOptions } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { unlink } from 'fs-extra'
import { join } from 'path'
import { request } from 'undici'
import { Inject, LauncherAppKey, kTempDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { AbstractService, Singleton } from '~/service'
import { UserService } from '~/user'
import { LauncherApp } from '../app/LauncherApp'
import { missing } from '../util/fs'
import { isValidUrl, joinUrl } from '../util/url'
import { ZipTask } from '../util/zip'

export class XUpdateService extends AbstractService implements IXUpdateService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app)
  }

  private async getAccessToken(userId: string): Promise<string> {
    throw new Error('Unimplemented')
  }

  @Singleton((o) => o.path)
  async uploadInstanceManifest({ path, manifest, headers, includeFileWithDownloads, forceJsonFormat }: SetInstanceManifestOptions): Promise<void> {
    const instancePath = path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    if (!instance.fileApi) {
      throw new InstanceIOException({ instancePath, type: 'instanceHasNoFileApi' })
    }

    const url = isValidUrl(instance.fileApi)
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https')) {
      throw new InstanceIOException({ instancePath, type: 'instanceInvalidFileApi', url: instance.fileApi })
    }

    const getTemp = await this.app.registry.get(kTempDataPath)
    const tempZipFile = getTemp(randomUUID())
    const useJson = forceJsonFormat || manifest.files.every(f => f.modrinth || f.curseforge || (f.downloads && f.downloads.length > 0))

    if (!useJson) {
      this.log(`Use zip to upload instance ${instancePath} to ${instance.fileApi}`)
      const task = new ZipTask(tempZipFile)

      for (const file of manifest.files) {
        const realPath = join(instancePath, file.path)
        const canBeDownload = file.modrinth || file.curseforge || (file.downloads && file.downloads.length > 0)
        if (includeFileWithDownloads || !canBeDownload) {
          task.addFile(realPath, file.path)
        }
      }

      task.addBuffer(Buffer.from(JSON.stringify(manifest), 'utf-8'), 'manifest.json')

      await task.startAndWait()
    } else {
      this.log(`Use json to upload instance ${instancePath} to ${instance.fileApi}`)
    }

    try {
      const start = Date.now()
      const allHeaders = headers ? { ...headers } : {}
      if (!allHeaders.Authorization) {
        // TODO: impl this
        const token = this.getAccessToken(/* UserState.getUser(this.userService.state)?.id ?? '' */ '')
        allHeaders.Authorization = `Bearer ${token}`
      }

      allHeaders['content-type'] = useJson ? 'application/json' : 'application/zip'

      const res = await request(instance.fileApi, {
        method: 'POST',
        headers: allHeaders,
        body: useJson ? JSON.stringify(manifest) : createReadStream(tempZipFile),
      })

      if (res.statusCode !== 201) {
        this.error(new Error(`Fail to upload ${instancePath} to ${instance.fileApi} as server rejected. Status code: ${res.statusCode}, ${res.body}`))
        throw new InstanceIOException({ type: 'instanceSetManifestFailed', httpBody: res.body, statusCode: res.statusCode })
      }

      for await (const _ of res.body) { /* skip */ }

      this.log(`Uploaded instance ${instancePath} to ${instance.fileApi}. Took ${Date.now() - start}ms.`)
    } finally {
      await unlink(tempZipFile).catch(() => undefined)
    }
  }

  @Singleton(p => p)
  async fetchInstanceUpdate(path: string): Promise<InstanceUpdate | undefined> {
    const instancePath = path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance.fileApi) {
      return undefined
    }

    let manifest: InstanceManifest
    try {
      manifest = await (await request(instance.fileApi)).body.json() as any
    } catch (e) {
      if (e instanceof Error) this.error(e)
      throw new InstanceIOException({
        type: 'instanceNotFoundInApi',
        url: instance.fileApi,
        statusCode: (e as any)?.response?.statusCode,
      })
    }

    const lookupFile = async (relativePath: string, hash: string, file: InstanceFile) => {
      const filePath = join(instancePath, relativePath)
      if (await missing(filePath)) {
        updates.push({
          file,
          operation: 'add',
        })
      } else {
        const sha1 = await checksum(filePath, 'sha1')
        if (sha1 !== hash) {
          updates.push({
            file,
            operation: 'update',
          })
        }
      }
    }

    const updates: InstanceUpdate['updates'] = []
    if (manifest.files) {
      for (const file of manifest.files) {
        await lookupFile(file.path, file.hashes.sha1, file)
        const fileApiUrl = joinUrl(instance.fileApi, file.path)
        if (file.downloads) {
          file.downloads.push(fileApiUrl)
        } else {
          file.downloads = [fileApiUrl]
        }
      }
    }
    return {
      updates,
      manifest,
    }
  }
}
