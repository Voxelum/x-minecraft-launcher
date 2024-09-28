import { LibraryInfo, Version } from '@xmcl/core'
import { ElyByServiceKey, ElyByService as IElyByService } from '@xmcl/runtime-api'
import { open, openEntryReadStream, walkEntriesGenerator } from '@xmcl/unzip'
import { createHash } from 'crypto'
import { ensureDir, readFile, stat, writeFile } from 'fs-extra'
import { dirname, isAbsolute, relative } from 'path'
import { Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { ResourceWorker, kResourceWorker } from '~/resource'
import { AnyError } from '~/util/error'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '../app'
import { AbstractService, ExposeServiceKey } from '../service'
import caches from './cache.json'

@ExposeServiceKey(ElyByServiceKey)
export class ElyByService extends AbstractService implements IElyByService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kResourceWorker) private resourceWorker: ResourceWorker,
  ) {
    super(app)
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

    const entries = caches
    const valid = entries.filter(e => minecraftVersion.startsWith(e.name))
    const resolvedVersion = valid.find(e => e.name === minecraftVersion) ||
      (valid.length > 0 ? valid[0] : undefined)

    if (!resolvedVersion || !resolvedVersion.id.endsWith('authlib')) {
      return undefined
    }

    const url = `https://ely.by/minecraft/system/${resolvedVersion}.zip`
    const resp = await this.app.fetch(url)
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

    throw new AnyError('ElyAuthlibInstallError', 'Failed to install authlib', undefined, { url })
  }
}
