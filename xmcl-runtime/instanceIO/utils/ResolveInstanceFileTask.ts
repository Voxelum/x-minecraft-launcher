import { CurseforgeV1Client, guessCurseforgeFileUrl } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { AbortableTask } from '@xmcl/task'
import { errors } from 'undici'
import { InstanceFile } from '@xmcl/instance'

export type RequiredPick<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Resolve instance file download link via curseforge and modrinth.
 * This will in-place update the instance file.
 */
export class ResolveInstanceFileTask extends AbortableTask<boolean> {
  private controller?: AbortController

  constructor(private files: Iterable<InstanceFile>, private curseforgeClient: CurseforgeV1Client, private modrinthClient: ModrinthV2Client) {
    super()
    this.name = 'resolve'
  }

  protected async process(): Promise<boolean> {
    const curseforgeProjects = [] as RequiredPick<InstanceFile, 'curseforge'>[]
    const modrinthProjects = [] as RequiredPick<InstanceFile, 'modrinth'>[]
    const modrinthFileHashProjects = [] as InstanceFile[]
    for (const file of this.files) {
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

    const controller = new AbortController()
    this.controller = controller

    let hasUpdate = false

    const processCurseforge = async () => {
      if (curseforgeProjects.length === 0) return
      const chunkSize = 128
      for (let i = 0; i < curseforgeProjects.length; i += chunkSize) {
        const chunk = curseforgeProjects.slice(i, i + chunkSize)
        const result = await this.curseforgeClient.getFiles(chunk.map(p => p.curseforge.fileId), controller.signal).catch((e) => {
          return []
        })
        for (const r of result) {
          const p = chunk.find(p => p.curseforge.fileId === r.id)!
          if (!p.downloads) { p.downloads = [] }
          const url = r.downloadUrl ? [r.downloadUrl] : guessCurseforgeFileUrl(r.id, r.fileName)
          for (const u of url) {
            if (p.downloads.indexOf(u) === -1) {
              p.downloads.push(u)
              hasUpdate = true
            }
          }
        }
      }
    }

    const processModrinth = async () => {
      if (modrinthProjects.length === 0) return
      const chunkSize = 128
      for (let i = 0; i < modrinthProjects.length; i += chunkSize) {
        const chunk = modrinthProjects.slice(i, i + chunkSize)
        const result = await this.modrinthClient.getProjectVersionsById(chunk.map(v => v.modrinth.versionId), controller.signal).catch((e) => {
          return []
        })
        for (const r of result) {
          const p = chunk.find(p => p.modrinth.versionId === r.id)!
          if (!p.downloads) { p.downloads = [] }
          if (p.downloads.indexOf(r.files[0].url) === -1) {
            p.downloads.push(r.files[0].url)
            hasUpdate = true
          }
        }
      }
    }

    const processModrinthLike = async () => {
      if (modrinthFileHashProjects.length === 0) return
      const chunkSize = 128
      for (let i = 0; i < modrinthFileHashProjects.length; i += chunkSize) {
        const chunk = modrinthFileHashProjects.slice(i, i + chunkSize)
        const result = await this.modrinthClient.getProjectVersionsByHash(chunk.filter(v => !!v.hashes.sha1).map(v => v.hashes.sha1), 'sha1', controller.signal).catch(e => {
          return {}
        })
        for (const [sha1, version] of Object.entries(result)) {
          const instanceFile = chunk.find(p => p.hashes.sha1 === sha1)!
          const file = version.files.find(f => f.hashes.sha1 === sha1) ?? version.files[0]
          if (!instanceFile.downloads) { instanceFile.downloads = [] }
          if (instanceFile.downloads.indexOf(file.url) === -1) {
            instanceFile.downloads.push(file.url)
            hasUpdate = true
          }
          if (!instanceFile.modrinth) {
            instanceFile.modrinth = {
              projectId: version.project_id,
              versionId: version.id,
            }
            hasUpdate = true
          }
        }
      }
    }

    await Promise.allSettled([
      processCurseforge(),
      processModrinth(),
      processModrinthLike(),
    ])

    return hasUpdate
  }

  protected abort(isCancelled: boolean): void {
    this.controller?.abort()
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}
