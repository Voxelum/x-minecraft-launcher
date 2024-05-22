import { CurseforgeV1Client, File, HashAlgo, Mod } from '@xmcl/curseforge'
import { CurseforgeModpackManifest, InstanceFile, ResourceDomain, getInstanceConfigFromCurseforgeModpack } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { LauncherAppPlugin } from '~/app'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { ModpackService } from './ModpackService'
import { getCurseforgeFiles, getCurseforgeProjects } from './getCurseforgeFiles'
import { resolveHashes } from './resolveHashes'
import { kResourceWorker } from '~/resource'

export const pluginCurseforgeModpackHandler: LauncherAppPlugin = async (app) => {
  const modpackService = await app.registry.get(ModpackService)
  modpackService.registerHandler<CurseforgeModpackManifest>('curseforge', {
    async resolveModpackMetadata(path, sha1) {
      const client = await app.registry.getOrCreate(CurseforgeV1Client)
      const worker = await app.registry.getOrCreate(kResourceWorker)

      const print = await worker.fingerprint(path)
      const result = await client.getFingerprintsMatchesByGameId(432, [print])
      const f = result.exactMatches[0]
      if (!f) return undefined
      return { curseforge: { projectId: f.file.modId, fileId: f.file.id } }
    },
    resolveUnpackPath: function (manifest: CurseforgeModpackManifest, e: Entry) {
      let overridePrefix = manifest.overrides ?? 'overrides/'
      if (!overridePrefix.endsWith('/')) overridePrefix += '/'
      if (e.fileName.startsWith(overridePrefix)) {
        return e.fileName.substring(overridePrefix.length)
      }
    },
    readManifest: async (zipFile: ZipFile, entries: Entry[]): Promise<CurseforgeModpackManifest | undefined> => {
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
      if (curseforgeFiles.length > 0) {
        const ids = curseforgeFiles.map(f => f.fileID).filter(id => typeof id === 'number')
        if (ids.length === 0) return []

        const client = await app.registry.getOrCreate(CurseforgeV1Client)
        const files = await getCurseforgeFiles(client, ids)
        const mods = await getCurseforgeProjects(client, files.map(f => f.modId))
        const infos: InstanceFile[] = []

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

        for (let i = 0; i < manifest.files.length; i++) {
          const manifestFile = manifest.files[i]
          const file = dict[manifestFile.fileID]
          const mod = modDict[file.modId]
          if (!file) {
            modpackService.warn(`Skip file ${manifestFile.fileID} because it is not found in curseforge API`)
            continue
          }
          let domain: ResourceDomain | undefined
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
        return infos
      }

      return []
    },
  })
}
