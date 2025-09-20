import { InstanceFile, ModrinthModpackManifest, getInstanceConfigFromModrinthModpack } from '@xmcl/instance'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { readEntry } from '@xmcl/unzip'
import { Entry } from 'yauzl'
import { LauncherApp } from '~/app'
import { ModpackHandler } from '../ModpackService'

export function createModrinthHandler(app: LauncherApp): ModpackHandler<ModrinthModpackManifest> {
  return {
    async resolveModpackMarketMetadata(path, sha1) {
      const client = await app.registry.getOrCreate(ModrinthV2Client)
      const hashes = await client.getProjectVersionsByHash([sha1], 'sha1')
      const content = hashes[sha1]
      if (!content) return undefined
      const file = content.files.find(f => f.hashes.sha1 === sha1)
      return {
        modrinth: {
          projectId: content.project_id,
          versionId: content.id,
          filename: file?.filename,
          url: file?.url,
        },
      }
    },
    async readManifest(zip, entries) {
      const modrinthManifest = entries.find(e => e.fileName === 'modrinth.index.json')
      if (modrinthManifest) {
        const b = await readEntry(zip, modrinthManifest)
        return JSON.parse(b.toString()) as ModrinthModpackManifest
      }
      const nonStandard = entries.find(e => e.fileName.endsWith('/modrinth.index.json'))
      if (nonStandard) {
        const b = await readEntry(zip, nonStandard)
        const basePath = nonStandard.fileName.substring(0, nonStandard.fileName.lastIndexOf('/'))
        return Object.assign(JSON.parse(b.toString()) as ModrinthModpackManifest, {
          __nonStandard: basePath
        })
      }
      return Promise.resolve(undefined)
    },
    resolveUnpackPath: (manifest: ModrinthModpackManifest, e: Entry) => {
      if ('__nonStandard' in manifest) {
        const prefix = manifest.__nonStandard as string
        if (e.fileName.startsWith(prefix + '/overrides')) {
          return e.fileName.substring((prefix + '/overrides').length + 1)
        }
        if (e.fileName.startsWith(prefix + '/client-overrides')) {
          return e.fileName.substring((prefix + '/client-overrides').length + 1)
        }
      } else {
        if (e.fileName.startsWith('overrides')) {
          return e.fileName.substring('overrides/'.length)
        }
        if (e.fileName.startsWith('client-overrides')) {
          return e.fileName.substring('client-overrides/'.length)
        }
      }
    },
    resolveInstanceOptions: getInstanceConfigFromModrinthModpack,
    resolveInstanceFiles: (manifest: ModrinthModpackManifest): Promise<InstanceFile[]> => {
      return Promise.resolve(manifest.files.map(meta => ({
        downloads: meta.downloads,
        hashes: meta.hashes,
        path: meta.path,
        size: meta.fileSize ?? 0,
      })))
    },
  }
}