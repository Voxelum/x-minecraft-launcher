import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceFile } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { errors } from 'undici'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { RequiredPick } from './instanceInstall'

export async function resolveInstanceFiles(
  files: InstanceFile[],
  curseforgeClient: CurseforgeV1Client, modrinthClient: ModrinthV2Client,
  signal?: AbortSignal,
) {
  const curseforgeProjects = [] as RequiredPick<InstanceFile, 'curseforge'>[]
  const modrinthProjects = [] as RequiredPick<InstanceFile, 'modrinth'>[]
  const modrinthFileHashProjects = [] as InstanceFile[]
  for (const file of files) {
    if (file.path.startsWith('resourcepacks') || file.path.startsWith('shaderpacks') || file.path.startsWith('mods')) {
      if (file.curseforge) {
        curseforgeProjects.push(file as any)
      }

      if (file.modrinth) {
        modrinthProjects.push(file as any)
      }

      if (!file.modrinth && !file.curseforge) {
        modrinthFileHashProjects.push(file)
      }
    }
  }

  const processCurseforge = async () => {
    if (curseforgeProjects.length === 0) return
    const result = await curseforgeClient.getFiles(curseforgeProjects.map(p => p.curseforge.fileId), signal)
    for (const r of result) {
      const p = curseforgeProjects.find(p => p.curseforge.fileId === r.id)!
      if (!p.downloads) { p.downloads = [] }
      const url = r.downloadUrl ? [r.downloadUrl] : guessCurseforgeFileUrl(r.id, r.fileName)
      p.downloads = [...new Set<string>([...url, ...p.downloads])]
    }
  }

  const processModrinth = async () => {
    if (modrinthProjects.length === 0) return
    const result = await modrinthClient.getProjectVersionsById(modrinthProjects.map(v => v.modrinth.versionId), signal)
    for (const r of result) {
      const p = modrinthProjects.find(p => p.modrinth.versionId === r.id)!
      if (!p.downloads) { p.downloads = [] }
      if (p.downloads.indexOf(r.files[0].url) === -1) {
        p.downloads.push(r.files[0].url)
      }
    }
  }

  const processModrinthLike = async () => {
    if (modrinthFileHashProjects.length === 0) return
    const result = await modrinthClient.getProjectVersionsByHash(modrinthFileHashProjects.filter(v => !!v.hashes.sha1).map(v => v.hashes.sha1), 'sha1', signal)
    for (const [sha1, version] of Object.entries(result)) {
      const instanceFile = modrinthFileHashProjects.find(p => p.hashes.sha1 === sha1)!
      const file = version.files.find(f => f.hashes.sha1 === sha1) ?? version.files[0]
      if (!instanceFile.downloads) { instanceFile.downloads = [] }
      if (instanceFile.downloads.indexOf(file.url) === -1) {
        instanceFile.downloads.push(file.url)
      }
      if (!instanceFile.modrinth) {
        instanceFile.modrinth = {
          projectId: version.project_id,
          versionId: version.id,
        }
      }
    }
  }

  await Promise.all([
    processCurseforge(),
    processModrinth(),
    processModrinthLike(),
  ])
}
