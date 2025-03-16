import { isNotNull } from '@xmcl/core/utils'
import { File as CurseforgeFile, CurseforgeV1Client, HashAlgo } from '@xmcl/curseforge'
import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client, ProjectVersion } from '@xmcl/modrinth'
import { File, InstanceFile as _InstanceFile, getCurseforgeFileUri, getModrinthPrimaryFile, getModrinthVersionFileUri } from '@xmcl/runtime-api'
import { basename, dirname, join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { InstanceInstallService } from '~/instanceIO'
import { kDownloadOptions } from '~/network'
import { ResourceManager } from '~/resource'
import { getFile } from '~/resource/core/files'
import { kTaskExecutor } from '~/task'
import { guessCurseforgeFileUrl } from '~/util/curseforge'
import { hardLinkFiles } from '~/util/fs'
import { InstallMarketDirectoryOptions, InstallMarketInstanceOptions, InstallResult, kMarketProvider } from './marketProvider'

type InstanceFile = _InstanceFile & { downloads: string[]; icon?: string }

export const pluginMarketProvider: LauncherAppPlugin = async (app) => {
  const modrinth = new ModrinthV2Client({ fetch: (...args) => app.fetch(...args) })
  app.registry.register(ModrinthV2Client, modrinth)
  const curseforge = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { fetch: (...args) => app.fetch(...args) })
  app.registry.register(CurseforgeV1Client, curseforge)

  const installService = await app.registry.get(InstanceInstallService)

  const resourceManager = await app.registry.get(ResourceManager)
  const submit = await app.registry.get(kTaskExecutor)

  async function getSnapshotByUris(file: InstanceFile, preferDir: string) {
    const uris = file.curseforge ? [getCurseforgeFileUri({ modId: file.curseforge.projectId, id: file.curseforge.fileId })] : [getModrinthVersionFileUri({ project_id: file.modrinth!.projectId, id: file.modrinth!.versionId, filename: basename(file.path) })]
    uris.push(...file.downloads)

    const hashes = await resourceManager.getHashesByUris(uris)

    if (hashes.length > 0) {
      const snapshots = await resourceManager.getSnapshotsByHash(hashes)

      const all = await Promise.all(snapshots.map(async (snapshot) => {
        const file = await resourceManager.validateSnapshotFile(snapshot)
        if (!file) {
          return undefined
        }
        return [file, snapshot] as const
      }))

      const existed = all.filter(isNotNull)

      const matched = existed.find(([file]) => dirname(file.path) === preferDir) || existed[0]

      if (!matched) {
        return undefined
      }

      const [file, snapshot] = matched

      const metadata = await resourceManager.getMetadataByHash(snapshot.sha1)
      return [file, snapshot, metadata || {}] as const
    }
    return undefined
  }

  async function ensureTheFile(destination: string, file: File) {
    if (file.path === destination) {
      return
    }
    if (dirname(file.path) === destination) {
      return
    }
    // try to link the file
    file.path = await hardLinkFiles(file.path, destination)
  }

  async function downloadFile(instFile: InstanceFile, domainDir: string, downloadOptions: DownloadBaseOptions) {
    const snapshoted = await getSnapshotByUris(instFile, domainDir)
    const filePath = join(domainDir, instFile.path)
    const uris = instFile.downloads

    if (snapshoted) {
      const [file, snapshot, metadata] = snapshoted
      await ensureTheFile(filePath, file)

      return {
        file,
        snapshot,
        uris,
        path: file.path,
        metadata: {
          ...metadata,
          modrinth: instFile.modrinth,
          curseforge: instFile.curseforge,
        },
      }
    }

    const task = new DownloadTask({
      ...downloadOptions,
      url: instFile.downloads,
      destination: filePath,
      validator: instFile.hashes.sha1 ? {
        algorithm: 'sha1',
        hash: instFile.hashes.sha1,
      } : instFile.hashes.md5 ? {
        algorithm: 'md5',
        hash: instFile.hashes.md5,
      } : undefined,
      pendingFile: filePath + '.pending',
    }).setName(instFile.modrinth ? 'installModrinthFile' : 'installCurseforgeFile',
      instFile.modrinth ? {
        projectId: instFile.modrinth.projectId,
        versionId: instFile.modrinth.versionId,
        filename: basename(instFile.path),
      } : {
        projectId: instFile.curseforge!.projectId,
        fileId: instFile.curseforge!.fileId,
      })
    await submit(task)

    return {
      uris,
      path: filePath,
      metadata: {
        modrinth: instFile.modrinth,
        curseforge: instFile.curseforge
      },
    }
  }

  async function postprocess(result: InstallResult, directory: string, icon: string | undefined) {
    const watched = resourceManager.getWatched(directory)
    if (watched) {
      watched.enqueue({
        filePath: result.path,
        metadata: result.metadata,
        uris: result.uris,
        icons: icon ? [icon] : undefined,
      })
    } else {
      const file = await getFile(result.path)
      if (file) {
        const snapshot = await resourceManager.getSnapshot(file)
        if (snapshot) {
          await resourceManager.updateMetadata([{
            hash: snapshot.sha1,
            metadata: result.metadata,
            uris: result.uris,
            icons: icon ? [icon] : undefined,
          }])
        }
      }
    }
  }

  function getModrinthFile(domain: string, version: ProjectVersion, filename?: string, icon?: string): InstanceFile {
    const file = version.files.find((f) => f.filename === filename)
    const modrinthFile = file || getModrinthPrimaryFile(version)
    const filePath = [domain, modrinthFile.filename].filter(v => !!v).join('/')

    const uris = [modrinthFile.url] as string[]


    return {
      path: filePath,
      hashes: modrinthFile.hashes,
      downloads: uris,
      size: modrinthFile.size,
      modrinth: {
        projectId: version.project_id,
        versionId: version.id,
      },
      icon,
    }
  }

  function getCurseforgeFile(domain: string, curseforgeFile: CurseforgeFile, icon?: string): InstanceFile {
    const filePath = [domain, curseforgeFile.fileName].filter(v => !!v).join('/')

    const uris = [] as string[]

    const downloadUrls = [] as string[]
    if (curseforgeFile.downloadUrl) {
      downloadUrls.push(curseforgeFile.downloadUrl)
    } else {
      // Guess the download url if the file url is not provided by curseforge
      downloadUrls.push(...guessCurseforgeFileUrl(curseforgeFile.id, curseforgeFile.fileName))
    }

    uris.push(...downloadUrls)

    const hashes: Record<string, string> = {}
    for (const hash of curseforgeFile.hashes) {
      if (hash.algo === HashAlgo.Sha1) {
        hashes.sha1 = hash.value
      } else if (hash.algo === HashAlgo.Md5) {
        hashes.md5 = hash.value
      }
    }

    return {
      path: filePath,
      hashes,
      downloads: uris,
      size: curseforgeFile.fileLength,
      curseforge: {
        projectId: curseforgeFile.modId,
        fileId: curseforgeFile.id,
      },
      icon,
    }
  }

  async function getFiles(options: InstallMarketDirectoryOptions | InstallMarketInstanceOptions): Promise<InstanceFile[]> {
    const domain = 'domain' in options ? options.domain : ''
    if (options.market === 0) {
      const versions = Array.isArray(options.version) ? options.version : [options.version]
      const versionsDict = Object.fromEntries(versions.map(v => [v.versionId, v]))
      const modrinthVersions = await modrinth.getProjectVersionsById(versions.map(v => v.versionId))
      const result = (modrinthVersions.map((version) => getModrinthFile(domain, version, versionsDict[version.id].filename, versionsDict[version.id].icon)))
      return result
    } else {
      const curseforgeFiles = Array.isArray(options.file) ? options.file : [options.file]
      const files = await curseforge.getFiles(curseforgeFiles.map(f => f.fileId))
      const fileDict = Object.fromEntries(curseforgeFiles.map(f => [f.fileId, f]))
      const result = files.map((file) => getCurseforgeFile(domain, file, fileDict[file.id].icon))
      return result
    }
  }

  app.registry.register(kMarketProvider, {
    installFile: async (options) => {
      const downloadOptions = await app.registry.get(kDownloadOptions)

      const files = await getFiles(options)

      const result = await Promise.all(files.map(async (file) => {
        const result = await downloadFile(file, options.directory, downloadOptions)
        await postprocess(result, options.directory, file.icon)
        return result
      }))
      return result
    },
    installInstanceFile: async (options: InstallMarketInstanceOptions) => {
      const files = await getFiles(options)

      await installService.installInstanceFiles({
        path: options.instancePath,
        files: files,
        oldFiles: [],
      })

      const result: InstallResult[] = files.map((file) => ({
        path: join(options.instancePath, file.path),
        uris: file.downloads,
        metadata: {
          modrinth: file.modrinth,
          curseforge: file.curseforge,
        },
      }))

      return result
    }
  })
}
