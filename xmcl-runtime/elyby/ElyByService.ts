import { LibraryInfo, Version } from '@xmcl/core'
import { ElyByServiceKey, ElyByService as IElyByService } from '@xmcl/runtime-api'
import { open, openEntryReadStream, walkEntriesGenerator } from '@xmcl/unzip'
import { createHash } from 'crypto'
import { ensureDir, readFile, readJSON, stat, writeFile, writeJSON } from 'fs-extra'
import { dirname, isAbsolute, join, relative } from 'path'
import { Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { ResourceWorker, kResourceWorker } from '~/resource'
import { AnyError } from '~/util/error'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '../app'
import { AbstractService, ExposeServiceKey } from '../service'

@ExposeServiceKey(ElyByServiceKey)
export class ElyByService extends AbstractService implements IElyByService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kResourceWorker) private resourceWorker: ResourceWorker,
  ) {
    super(app)
    this.#init().catch(e => this.warn('Failed to init elyby authlib', e))
  }

  async #init() {
    const cachePath = join(this.app.appDataPath, 'ely-authlib.cache.json')
    const content = await readJSON(cachePath, 'utf-8').catch(() => undefined)
    const etag = content?.etag
    const resp = await this.app.fetch('https://api.xmcl.app/elyby/authlib', {
      headers: etag ? {
        'If-None-Match': etag,
      } : {},
    })
    if (!resp.ok) {
      return
    }
    const data = await resp.json()
    await writeJSON(cachePath, {
      etag: resp.headers.get('etag'),
      data,
    })
  }

  async #getCache() {
    const cachePath = join(this.app.appDataPath, 'ely-authlib.cache.json')
    const cache = await readJSON(cachePath, 'utf-8').then((content) => {
      return content.data
    }).catch(() => import('./cache.json'))
    return cache as Array<{
      minecraft: string
      id: string
    }>
  }

  async installAuthlib(minecraftVersion: string) {
    interface RecordVersion { path: string; sha1: string; version: string }

    const jsonPath = this.getAppDataPath('ely-authlib.json')

    const content: Record<string, RecordVersion> = await readFile(jsonPath, 'utf-8').then(JSON.parse).catch(() => ({}))
    const record = content[minecraftVersion]
    for (const key in content) {
      const val = content[key]
      if (isAbsolute(val.path)) {
        continue
      }
      val.path = this.getPath(val.path)
    }

    if (record) {
      const path = record.path
      const sha1 = record.sha1
      const version = record.version

      const actualSha1 = await this.resourceWorker.checksum(path, 'sha1').catch(() => '')
      if (actualSha1 === sha1) {
        const info = LibraryInfo.resolve('com.mojang:authlib:' + version + ':elyby')
        return Version.resolveLibrary({
          name: info.name,
          downloads: {
            artifact: {
              url: '',
              path: info.path,
              sha1,
              size: (await stat(path)).size,
            },
          },
        })
      }
    }

    const entries = await this.#getCache()
    const valid = entries.filter(e => minecraftVersion.startsWith(e.minecraft))
    const resolvedVersion = valid.find(e => e.minecraft === minecraftVersion) ||
      (valid.length > 0 ? valid[0] : undefined)

    if (!resolvedVersion) {
      return undefined
    }

    const url = `https://ely.by/minecraft/system/${resolvedVersion.id}.zip`
    const errors = [] as any[]
    for (let i = 0; i < 3; i++) {
      try {
        const resp = await this.app.fetch(url)
        if (!resp.ok) {
          if (resp.status === 404) {
            throw new AnyError('ElyAuthlibNotFoundError', 'Failed to download authlib', undefined, { url })
          }
          this.warn('Failed to download authlib', resp.statusText)
          continue
        }
        const buf = await resp.arrayBuffer()
        const zip = await open(Buffer.from(buf))
        for await (const e of walkEntriesGenerator(zip)) {
          if (e.fileName.endsWith('.jar')) {
            const name = e.fileName.split('/').pop()!
            const actualVersion = name.split('-')[1].split('.jar')[0]

            const stream = await openEntryReadStream(zip, e)
            const hasher = createHash('sha1')
            const info = LibraryInfo.resolve('com.mojang:authlib:' + actualVersion + ':elyby')

            const buffers: Buffer[] = []
            await pipeline(stream, new Writable({
              write(chunk, _, callback) {
                hasher.update(chunk)
                buffers.push(chunk)
                callback()
              },
            }))
            const path = this.getPath('libraries', info.path)
            await ensureDir(dirname(path))
            await writeFile(path, Buffer.concat(buffers))
            const sha1 = hasher.digest('hex')
            content[minecraftVersion] = {
              path: relative(this.getPath(), path),
              sha1,
              version: actualVersion,
            }
            await writeFile(jsonPath, JSON.stringify(content, null, 4))

            // ResolvedLibrary
            const lib = Version.resolveLibrary({
              name: info.name,
              downloads: {
                artifact: {
                  url: '',
                  path: info.path,
                  sha1,
                  size: e.uncompressedSize,
                },
              },
            })
            return lib
          }
        }

        break
      } catch (e) {
        errors.push(e)
        this.warn('Failed to download authlib', e)
      }
    }

    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0]
      }
      throw new AggregateError(errors.flatMap(e => e instanceof AggregateError ? e.errors : e))
    }
    throw new AnyError('ElyAuthlibInstallError', 'Failed to install authlib', undefined, { url })
  }
}
