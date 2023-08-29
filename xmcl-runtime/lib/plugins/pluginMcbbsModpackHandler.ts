import { File, HashAlgo } from '@xmcl/curseforge'
import { InstanceFile, McbbsModpackManifest, ModpackFileInfoCurseforge, ResourceDomain, getInstanceConfigFromMcbbsModpack } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { join } from 'path'
import { Entry } from 'yauzl'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { CurseForgeService } from '../services/CurseForgeService'
import { ModpackService } from '../services/ModpackService'
import { guessCurseforgeFileUrl } from '../util/curseforge'

export const pluginMcbbsModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  const curseforgeService = await app.registry.get(CurseForgeService)
  modpackService.registerHandler<McbbsModpackManifest>('mcbbs', {
    readMetadata: async (zip, entries) => {
      const mcbbsManifest = entries.find(e => e.fileName === 'mcbbs.packmeta')
      if (mcbbsManifest) {
        return readEntry(zip, mcbbsManifest).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
      }
    },
    resolveInstanceOptions: getInstanceConfigFromMcbbsModpack,
    resolveInstanceFiles: async (manifest) => {
      const infos: InstanceFile[] = []
      if (manifest.files) {
        // curseforge or mcbbs
        const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
        const files = await curseforgeService.client.getFiles(curseforgeFiles.map(f => f.fileID))

        const dict: Record<string, File> = {}
        for (const file of files) {
          if (dict[file.id]) {
            modpackService.warn(`Duplicated curseforge file return from curseforge API: ${file.id}`)
          }
          dict[file.id] = file
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
          const domain = file.fileName.endsWith('.jar') ? ResourceDomain.Mods : file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
          const sha1 = file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value
          infos.push({
            downloads: file.downloadUrl ? [file.downloadUrl] : guessCurseforgeFileUrl(file.id, file.fileName),
            path: join(domain, file.fileName),
            hashes: sha1
              ? {
                sha1: file.hashes.find(v => v.algo === HashAlgo.Sha1)?.value,
              } as Record<string, string>
              : {},
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
