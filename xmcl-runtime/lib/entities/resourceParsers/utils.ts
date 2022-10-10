import { File, HashAlgo } from '@xmcl/curseforge'
import { CurseforgeModpackManifest, InstanceFile, McbbsModpackManifest, ModpackFileInfoCurseforge, ModrinthModpackManifest, ResourceDomain } from '@xmcl/runtime-api'
import { FileSystem } from '@xmcl/system'
import { openEntryReadStream } from '@xmcl/unzip'
import { join } from 'path'
import { request } from 'undici'
import { Entry } from 'yauzl'
import { resolveInstanceOptions } from '../modpack'
import { guessCurseforgeFileUrl } from '/@main/util/curseforge'
import { checksumFromStream } from '/@main/util/fs'

export async function getInstallModpackProfile(fs: FileSystem, manifest: CurseforgeModpackManifest | McbbsModpackManifest | ModrinthModpackManifest) {
  const files = await fs.listFiles('.')
  const instance = resolveInstanceOptions(manifest)

  const getEntryPath = (e: Entry) => e.fileName.substring('overrides' in manifest ? manifest.overrides.length : 'overrides'.length)

  // const resultFiles = (await Promise.all(files
  //   .filter((e) => !e.endsWith('/') && e.startsWith('overrides' in manifest ? manifest.overrides : 'overrides'))
  //   .map(async (v) => {
  //     const sha1 = await checksumFromStream(await openEntryReadStream(zip, v), 'sha1')
  //     const file: InstanceFile = {
  //       path: getEntryPath(v),
  //       size: v.uncompressedSize,
  //       hashes: {
  //         sha1,
  //         crc32: v.crc32.toString(),
  //       },
  //       downloads: [`zip:${join(path, getEntryPath(v))}`],
  //     }
  //     return file
  //   })))
  //   .concat(await convertManifest(manifest))

  // return {
  //   instance,
  //   files: resultFiles,
  // }
}

export async function convertManifest(manifest: CurseforgeModpackManifest | McbbsModpackManifest | ModrinthModpackManifest) {
  const infos = [] as InstanceFile[]
  if (manifest.files) {
    if ('manifestVersion' in manifest) {
      // curseforge or mcbbs
      const curseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse' || 'hashes' in f)
      const res = await request('https://api.curseforge.com/v1/mods/files', {
        body: JSON.stringify(curseforgeFiles.map(f => f.fileID)),
        headers: {
          accept: 'application/json',
          'x-api-key': process.env.CURSEFORGE_API_KEY,
          'content-type': 'application/json',
        },
      })
      const files: File[] = await res.body.json()

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const domain = file.modules.some(f => f.name === 'META-INF') ? ResourceDomain.Mods : ResourceDomain.ResourcePacks
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
    } else {
      // modrinth
      for (const meta of manifest.files) {
        infos.push({
          downloads: meta.downloads,
          hashes: meta.hashes,
          path: meta.path,
          size: meta.fileSize ?? 0,
        })
      }
    }
  }
  return infos
}
