import { InstanceFile, ModrinthModpackManifest, getInstanceConfigFromModrinthModpack } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '~/app'
import { ModpackService } from './ModpackService'
import { readEntry } from '@xmcl/unzip'
import { Entry } from 'yauzl'
import { ModrinthV2Client } from '@xmcl/modrinth'

export const pluginModrinthModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  modpackService.registerHandler<ModrinthModpackManifest>('modrinth', {
    async resolveModpackMetadata(path, sha1) {
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
      return Promise.resolve(undefined)
    },
    resolveUnpackPath: (manifest: ModrinthModpackManifest, e: Entry) => {
      if (e.fileName.startsWith('overrides')) {
        return e.fileName.substring('overrides/'.length)
      }
      if (e.fileName.startsWith('client-overrides')) {
        return e.fileName.substring('client-overrides/'.length)
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
  })
}
