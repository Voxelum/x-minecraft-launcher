import { CurseforgeV1Client, File, HashAlgo, Mod } from '@xmcl/curseforge'
import { InstanceFile, McbbsModpackManifest, ModpackFileInfoCurseforge, ResourceDomain, getInstanceConfigFromMcbbsModpack } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { join } from 'path'
import { Entry } from 'yauzl'
import { LauncherAppPlugin } from '~/app'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { ModpackService } from './ModpackService'
import { getCurseforgeFiles, getCurseforgeProjects } from './getCurseforgeFiles'
import { resolveHashes } from './resolveHashes'

export const pluginMcbbsModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  modpackService.registerHandler<McbbsModpackManifest>('mcbbs', {
    readManifest: async (zip, entries) => {
      const mcbbsManifest = entries.find(e => e.fileName === 'mcbbs.packmeta')
      if (mcbbsManifest) {
        return readEntry(zip, mcbbsManifest).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
      }
    },
    resolveInstanceOptions: getInstanceConfigFromMcbbsModpack,
    resolveInstanceFiles: async (manifest) => {
      const infos: InstanceFile[] = []
      if (manifest.files && manifest.files.length > 0) {
        // curseforge or mcbbs
        const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
        const ids = curseforgeFiles.map(f => f.fileID).filter(id => typeof id === 'number')
        const client = await app.registry.getOrCreate(CurseforgeV1Client)
        const files = await getCurseforgeFiles(client, ids)
        const mods = await getCurseforgeProjects(client, files.map(f => f.modId))

        const dict: Record<string, File> = {}
        for (const file of files) {
          if (dict[file.id]) {
            modpackService.warn(`Duplicated curseforge file return from curseforge API: ${file.id}`)
          }
          dict[file.id] = file
        }
        const modDict: Record<string, Mod> = {}
        for (const mod of mods) {
          if (modDict[mod.id]) {
            modpackService.warn(`Duplicated curseforge mod return from curseforge API: ${mod.id}`)
          }
          modDict[mod.id] = mod
        }

        for (let i = 0; i < files.length; i++) {
          const manifestFile = manifest.files[i]
          if (!('fileID' in manifestFile)) {
            continue
          }
          const file = dict[manifestFile.fileID]
          if (!file) {
            modpackService.warn(`Skip file ${manifestFile.fileID} because it is not found in curseforge API`)
            continue
          }
          let domain: ResourceDomain | undefined
          const mod = modDict[file.modId]
          if (mod) {
            domain = mod.primaryCategoryId === 12
              ? ResourceDomain.ResourcePacks
              : mod.primaryCategoryId === 6
                ? ResourceDomain.Mods
                : undefined
          }
          if (!domain) {
            domain = file.fileName.endsWith('.jar') ? ResourceDomain.Mods : file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
          }
          infos.push({
            downloads: file.downloadUrl ? [file.downloadUrl] : guessCurseforgeFileUrl(file.id, file.fileName),
            path: join(domain, file.fileName),
            hashes: resolveHashes(file),
            curseforge: {
              fileId: file.id,
              projectId: file.modId,
            },
            size: file.fileLength,
          })
        }
      }
      return infos
    },
    resolveUnpackPath: function (manifest: McbbsModpackManifest, e: Entry) {
      const overridePrefix = 'overrides/'
      if (e.fileName.startsWith(overridePrefix)) {
        return e.fileName.substring(overridePrefix.length)
      }
    },
  })
}
