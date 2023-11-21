import { InstanceFile, ModrinthModpackManifest, getInstanceConfigFromModrinthModpack } from '@xmcl/runtime-api'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { ModpackService } from '../services/ModpackService'
import { readEntry } from '@xmcl/unzip'
import { Entry } from 'yauzl'

export const pluginModrinthModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  modpackService.registerHandler<ModrinthModpackManifest>('modrinth', {
    async readMetadata(zip, entries) {
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
