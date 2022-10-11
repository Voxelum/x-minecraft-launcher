import { CurseforgeModpackManifest, EditInstanceOptions, InstanceFile, ModrinthModpackManifest } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { ModpackService } from './ModpackService'
import { AbstractService } from './Service'

export class ModpackModrinthService extends AbstractService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ModpackService) modpackService: ModpackService,
  ) {
    super(app)

    modpackService.registerHandler<ModrinthModpackManifest>('modrinth', {
      async readMetadata(zip, entries) {
        const modrinthManifest = entries.find(e => e.fileName === 'modrinth.index.json')
        if (modrinthManifest) {
          const b = await readEntry(zip, modrinthManifest)
          return JSON.parse(b.toString()) as ModrinthModpackManifest
        }
        return Promise.resolve(undefined)
      },
      shouldUnpackAsOverride: (manifest: ModrinthModpackManifest, e: Entry): boolean => {
        throw new Error('Function not implemented.')
      },
      resolveInstanceOptions: (manifest: ModrinthModpackManifest): EditInstanceOptions => {
        return {
          name: manifest.name,
          version: manifest.versionId,
          description: manifest.summary,
          runtime: {
            minecraft: manifest.dependencies.minecraft,
            forge: manifest.dependencies.forge,
            fabricLoader: manifest.dependencies['fabric-loader'],
            quiltLoader: manifest.dependencies['quilt-loader'],
          },
        }
      },
      resolveInstanceFiles: (manifest: ModrinthModpackManifest): Promise<InstanceFile[]> => {
        return Promise.resolve(manifest.files.map(meta => ({
          downloads: meta.downloads,
          hashes: meta.hashes,
          path: meta.path,
          size: meta.fileSize ?? 0,
        })))
      },
    })

    modpackService.registerHandler('curseforge', {
      shouldUnpackAsOverride: function (manifest: CurseforgeModpackManifest, e: Entry): boolean {
        throw new Error('Function not implemented.')
      },
      readMetadata: async (zipFile: ZipFile, entries: Entry[]): Promise<CurseforgeModpackManifest | undefined> => {
        const curseforgeManifest = entries.find(e => e.fileName === 'manifest.json')
        if (curseforgeManifest) {
          const b = await readEntry(zipFile, curseforgeManifest)
          return JSON.parse(b.toString()) as CurseforgeModpackManifest
        }
      },
      resolveInstanceOptions: function (manifest: CurseforgeModpackManifest): EditInstanceOptions {
        const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
        const fabricId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))
        return {
          author: manifest.author,
          version: manifest.version,
          name: manifest.name,
          runtime: {
            minecraft: manifest.minecraft.version,
            forge: forgeId ? forgeId.id.substring(6) : '',
            liteloader: '',
            fabricLoader: fabricId ? fabricId.id.substring(7) : '',
            yarn: '',
          },
        }
      },
      resolveInstanceFiles: async (manifest: CurseforgeModpackManifest): Promise<InstanceFile[]> => {
        // curseforge or mcbbs
        const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
        const files = await curseforgeService.fetchModFiles(curseforgeFiles.map(f => f.fileID))

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
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
      },
    })
  }
}
