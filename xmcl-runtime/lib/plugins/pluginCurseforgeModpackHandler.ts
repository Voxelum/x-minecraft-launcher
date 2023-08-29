import { File, HashAlgo } from '@xmcl/curseforge'
import { CurseforgeModpackManifest, InstanceFile, ResourceDomain, getInstanceConfigFromCurseforgeModpack } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { CurseForgeService } from '../services/CurseForgeService'
import { ModpackService } from '../services/ModpackService'
import { guessCurseforgeFileUrl } from '../util/curseforge'

export const pluginCurseforgeModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  const curseforgeService = await app.registry.get(CurseForgeService)
  modpackService.registerHandler<CurseforgeModpackManifest>('curseforge', {
    resolveUnpackPath: function (manifest: CurseforgeModpackManifest, e: Entry) {
      let overridePrefix = manifest.overrides ?? 'overrides/'
      if (!overridePrefix.endsWith('/')) overridePrefix += '/'
      if (e.fileName.startsWith(overridePrefix)) {
        return e.fileName.substring(overridePrefix.length)
      }
    },
    readMetadata: async (zipFile: ZipFile, entries: Entry[]): Promise<CurseforgeModpackManifest | undefined> => {
      const curseforgeManifest = entries.find(e => e.fileName === 'manifest.json')
      if (curseforgeManifest) {
        const b = await readEntry(zipFile, curseforgeManifest)
        return JSON.parse(b.toString()) as CurseforgeModpackManifest
      }
    },
    resolveInstanceOptions: getInstanceConfigFromCurseforgeModpack,
    resolveInstanceFiles: async (manifest: CurseforgeModpackManifest): Promise<InstanceFile[]> => {
      // curseforge or mcbbs
      const curseforgeFiles = manifest.files
      const files = await curseforgeService.client.getFiles(curseforgeFiles.map(f => f.fileID))
      const infos: InstanceFile[] = []

      const dict: Record<string, File> = {}
      for (const file of files) {
        if (dict[file.id]) {
          modpackService.warn(`Duplicated curseforge file return from curseforge API: ${file.id}`)
        }
        dict[file.id] = file
      }

      for (let i = 0; i < manifest.files.length; i++) {
        const manifestFile = manifest.files[i]
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

      return infos
    },
  })
}
