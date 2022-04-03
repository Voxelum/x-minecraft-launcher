import { createDefaultCurseforgeQuery, DownloadBaseOptions, DownloadTask, UnzipTask } from '@xmcl/installer'
import { joinUrl } from '@xmcl/installer/http/utils'
import { CurseforgeModpackManifest, EditInstanceOptions, McbbsModpackManifest, ModpackFileInfoAddon, ModpackFileInfoCurseforge } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { readEntry } from '@xmcl/unzip'
import { ensureDir } from 'fs-extra'
import { Agent } from 'https'
import { basename, join } from 'path'
import { URL } from 'url'
import { Entry, ZipFile } from 'yauzl'

/**
 * Read the metadata of the modpack
 * @param zip The modpack zip
 * @returns The curseforge or mcbbs manifest
 */
export async function readMetadata(zip: ZipFile, entries: Entry[]) {
  const mcbbsManifest = entries.find(e => e.fileName === 'mcbbs.packmeta')
  if (mcbbsManifest) {
    return readEntry(zip, mcbbsManifest).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
  }
  const curseforgeManifest = entries.find(e => e.fileName === 'manifest.json')
  if (curseforgeManifest) {
    return readEntry(zip, curseforgeManifest).then(b => JSON.parse(b.toString()) as CurseforgeModpackManifest)
  }
  throw new Error()
}

export function resolveInstanceOptions(manifest: McbbsModpackManifest | CurseforgeModpackManifest): EditInstanceOptions {
  const options: EditInstanceOptions = {
    author: manifest.author,
    version: manifest.version,
    name: manifest.name,
  }
  if ('addons' in manifest) {
    options.description = manifest.description
    options.url = manifest.url
    options.runtime = {
      minecraft: manifest.addons.find(a => a.id === 'game')?.version ?? '',
      forge: manifest.addons.find(a => a.id === 'forge')?.version ?? '',
      liteloader: '',
      fabricLoader: manifest.addons.find(a => a.id === 'fabric')?.version ?? '',
      yarn: '',
    }
    if (manifest.launchInfo) {
      if (manifest.launchInfo.launchArgument) {
        options.mcOptions = manifest.launchInfo.launchArgument
      }
      if (manifest.launchInfo.javaArgument) {
        options.vmOptions = manifest.launchInfo.javaArgument
      }
      if (manifest.launchInfo.minMemory) {
        options.minMemory = Number(manifest.launchInfo.minMemory)
      }
      // if (manifest.launchInfo.supportJava) {
      // options.java
      // }
    }
  } else {
    const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
    const fabricId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))
    options.runtime = {
      minecraft: manifest.minecraft.version,
      forge: forgeId ? forgeId.id.substring(6) : '',
      liteloader: '',
      fabricLoader: fabricId ? fabricId.id.substring(7) : '',
      yarn: '',
    }
  }
  return options
}

export class ModpackInstallGeneralError extends Error {
  constructor(readonly files: {
    path: string
    url: string
    projectId: number
    fileId: number
  }[], e: Error) { super(`Fail to install modpack: ${e.message}`) }
}

export class ModpackInstallUrlError extends Error {
  constructor(readonly file: ModpackFileInfoCurseforge) {
    super(`Fail to get curseforge download url project=${file.projectID} file=${file.fileID}`)
  }
}

export function installModpackTask(zip: ZipFile, entries: Entry[], manifest: CurseforgeModpackManifest | McbbsModpackManifest, root: string, allowFileApi: boolean, options: DownloadBaseOptions & { agents: { https: Agent } }) {
  return task('installModpack', async function () {
    const files: Array<{ path: string; url: string; projectId: number; fileId: number }> = []
    const getCurseforgeUrl = createDefaultCurseforgeQuery(options.agents.https)
    const isValidateUrl = (url: string) => {
      try {
        // eslint-disable-next-line no-new
        new URL(url)
        return true
      } catch (e) {
        return false
      }
    }
    const ensureDownloadUrl = async (f: ModpackFileInfoCurseforge) => {
      for (let i = 0; i < 3; ++i) {
        const result = await getCurseforgeUrl(f.projectID, f.fileID)
        if (isValidateUrl(result)) {
          return result
        }
      }
      throw new ModpackInstallUrlError(f)
    }
    if (manifest.files) {
      const allCurseforgeFiles = manifest.files.map(f => f).filter((f): f is ModpackFileInfoCurseforge => !('type' in f) || f.type === 'curse')
      const staging = join(root, 'mods')
      await ensureDir(staging)
      const infos = [] as (ModpackFileInfoCurseforge & { url: string })[]
      infos.push(...await Promise.all(allCurseforgeFiles.map(async (f) => ({ ...f, url: await ensureDownloadUrl(f) }))))

      // download curseforge files
      const tasks = infos.map((f) => {
        const url = f.url
        const destination = join(staging, basename(url))
        return new DownloadTask({
          url,
          destination,
          agents: options.agents,
          segmentPolicy: options.segmentPolicy,
          retryHandler: options.retryHandler,
        }).setName('download').map(() => {
        // side-effect: adding to file list
          files.push({ path: destination, url, projectId: f.projectID, fileId: f.fileID })
          return undefined
        })
      })

      try {
        await this.all(tasks, {
          throwErrorImmediately: false,
          getErrorMessage: (errs) => `Fail to install modpack to ${root}: ${errs.map((e) => e.toString()).join('\n')}`,
        })
      } catch (e) {
        throw new ModpackInstallGeneralError(files, e as Error)
      }
    }

    try {
      await this.yield(new UnzipTask(
        zip,
        entries.filter((e) => !e.fileName.endsWith('/') && e.fileName.startsWith('overrides' in manifest ? manifest.overrides : 'overrides')),
        root,
        (e) => e.fileName.substring('overrides' in manifest ? manifest.overrides.length : 'overrides'.length),
      ).setName('unpack'))

      // download custom files
      if ('fileApi' in manifest && manifest.files && manifest.fileApi && allowFileApi) {
        const fileApi = manifest.fileApi
        const addonFiles = manifest.files.filter((f): f is ModpackFileInfoAddon => f.type === 'addon')
        await this.all(addonFiles.map((f) => new DownloadTask({
          url: joinUrl(fileApi, f.path),
          destination: join(root, f.path),
          validator: {
            algorithm: 'sha1',
            hash: f.hash,
          },
          agents: options.agents,
          segmentPolicy: options.segmentPolicy,
          retryHandler: options.retryHandler,
        }).setName('download')))
      }
    } catch (e) {
      throw new ModpackInstallGeneralError(files, e as Error)
    }

    return files
  })
}
