import { isNotNull } from '@xmcl/core/utils'
import { File as CurseforgeFile, CurseforgeV1Client } from '@xmcl/curseforge'
import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client, ProjectVersion } from '@xmcl/modrinth'
import { File, getCurseforgeFileUri, getModrinthPrimaryFile, getModrinthVersionFileUri, getModrinthVersionUri } from '@xmcl/runtime-api'
import { dirname, join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { kDownloadOptions } from '~/network'
import { ResourceManager } from '~/resource'
import { getFile } from '~/resource/core/files'
import { kTaskExecutor } from '~/task'
import { guessCurseforgeFileUrl, resolveCurseforgeHash } from '~/util/curseforge'
import { InstallResult, kMarketProvider } from './marketProvider'
import { hardLinkFiles } from '~/util/fs'

export const pluginMarketProvider: LauncherAppPlugin = async (app) => {
  const modrinth = new ModrinthV2Client({ fetch: (...args) => app.fetch(...args) })
  app.registry.register(ModrinthV2Client, modrinth)
  const curseforge = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { fetch: (...args) => app.fetch(...args) })
  app.registry.register(CurseforgeV1Client, curseforge)

  const resourceManager = await app.registry.get(ResourceManager)
  const submit = await app.registry.get(kTaskExecutor)

  async function getSnapshotByUris(uris: string[], preferDir: string) {
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

  async function downloadCurseforge(downloadOptions: DownloadBaseOptions, destination: string, curseforgeFile: CurseforgeFile) {
    const uris = [getCurseforgeFileUri(curseforgeFile)]
    const filePath = join(destination, curseforgeFile.fileName)

    const downloadUrls = [] as string[]
    if (curseforgeFile.downloadUrl) {
      downloadUrls.push(curseforgeFile.downloadUrl)
    } else {
      // Guess the download url if the file url is not provided by curseforge
      downloadUrls.push(...guessCurseforgeFileUrl(curseforgeFile.id, curseforgeFile.fileName))
    }
    uris.push(...downloadUrls)

    const snapshoted = await getSnapshotByUris(uris, destination)

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
          curseforge: {
            projectId: curseforgeFile.modId,
            fileId: curseforgeFile.id,
          },
        },
      }
    }

    const task = new DownloadTask({
      ...downloadOptions,
      url: downloadUrls,
      validator: resolveCurseforgeHash(curseforgeFile.hashes),
      destination: filePath,
      pendingFile: filePath + '.pending',
    }).setName('installCurseforgeFile', { modId: curseforgeFile.modId, fileId: curseforgeFile.id })
    await submit(task)

    return {
      uris,
      path: filePath,
      metadata: {
        curseforge: {
          projectId: curseforgeFile.modId,
          fileId: curseforgeFile.id,
        },
      },
    }
  }

  async function downloadModrinth(downloadOptions: DownloadBaseOptions, destination: string, version: ProjectVersion, filename?: string) {
    const file = version.files.find((f) => f.filename === filename)
    const modrinthFile = file || getModrinthPrimaryFile(version)
    const filePath = join(destination, modrinthFile.filename)

    const uris = [modrinthFile.url] as string[]
    const isSingleFile = version.files.length === 1
    uris.push(getModrinthVersionFileUri({ project_id: version.project_id, id: version.id, filename: modrinthFile.filename }))
    if (isSingleFile) {
      uris.push(getModrinthVersionUri(version))
    }

    const snapshoted = await getSnapshotByUris(uris, destination)

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
          modrinth: {
            projectId: version.project_id,
            versionId: version.id,
          },
        },
      }
    }

    const hashes = Object.entries(modrinthFile.hashes)
    const task = new DownloadTask({
      ...downloadOptions,
      url: modrinthFile.url,
      destination: filePath,
      validator: {
        algorithm: hashes[0][0],
        hash: hashes[0][1],
      },
      pendingFile: filePath + '.pending',
    }).setName('installModrinthFile', {
      projectId: version.project_id,
      versionId: version.id,
      filename: modrinthFile.filename,
    })
    await submit(task)

    return {
      uris,
      path: filePath,
      metadata: {
        modrinth: {
          projectId: version.project_id,
          versionId: version.id,
        },
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
        result.file = file
        const snapshot = await resourceManager.getSnapshot(file)
        if (snapshot) {
          result.snapshot = snapshot
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

  app.registry.register(kMarketProvider, {
    installFile: async (options) => {
      const downloadOptions = await app.registry.get(kDownloadOptions)

      if (options.market === 0) {
        const versions = Array.isArray(options.version) ? options.version : [options.version]
        const versionsDict = Object.fromEntries(versions.map(v => [v.versionId, v]))
        const modrinthVersions = await modrinth.getProjectVersionsById(versions.map(v => v.versionId))
        const result = await Promise.all(modrinthVersions.map(async (version) => {
          const info = versionsDict[version.id]
          const result = await downloadModrinth(downloadOptions, options.directory, version, info.filename)
          await postprocess(result, options.directory, info.icon)
          return result
        }))
        return result
      } else {
        const curseforgeFiles = Array.isArray(options.file) ? options.file : [options.file]
        const files = await curseforge.getFiles(curseforgeFiles.map(f => f.fileId))
        const fileDict = Object.fromEntries(curseforgeFiles.map(f => [f.fileId, f]))
        const result = await Promise.all(files.map(async (file) => {
          const info = fileDict[file.id]
          const result = await downloadCurseforge(downloadOptions, options.directory, file)
          await postprocess(result, options.directory, info.icon)
          return result
        }))
        return result
      }
    },
  })
}
