import { isNotNull } from '@xmcl/core/utils'
import { CurseforgeV1Client } from '@xmcl/curseforge'
import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { getCurseforgeFileUri, getModrinthPrimaryFile, getModrinthVersionFileUri, getModrinthVersionUri, InstallMarketOptionsCurseforge, InstallMarketOptionsModrinth } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { kDownloadOptions } from '~/network'
import { ResourceManager } from '~/resource'
import { getFile } from '~/resource/core/files'
import { kTaskExecutor } from '~/task'
import { guessCurseforgeFileUrl, resolveCurseforgeHash } from '~/util/curseforge'
import { InstallMarketDirectoryOptions, kMarketProvider } from './marketProvider'

export const pluginMarketProvider: LauncherAppPlugin = async (app) => {
  const modrinth = new ModrinthV2Client({ fetch: (...args) => app.fetch(...args) })
  app.registry.register(ModrinthV2Client, modrinth)
  const curseforge = new CurseforgeV1Client(process.env.CURSEFORGE_API_KEY || '', { fetch: (...args) => app.fetch(...args) })
  app.registry.register(CurseforgeV1Client, curseforge)

  const resourceManager = await app.registry.get(ResourceManager)
  const submit = await app.registry.get(kTaskExecutor)

  function getFilePath(directory: string, fileName: string) {
    while (existsSync(join(directory, fileName))) {
      fileName = '_' + fileName
    }
    return join(directory, fileName)
  }

  async function getSnapshotByUris(uris: string[]) {
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

      const existed = all.filter(isNotNull)[0]

      if (!existed) {
        return undefined
      }

      const [file, snapshot] = existed

      const metadata = await resourceManager.getMetadataByHash(snapshot.sha1)
      return [file, snapshot, metadata || {}] as const
    }
    return undefined
  }

  async function downloadCurseforge(downloadOptions: DownloadBaseOptions, destination: string, options: InstallMarketDirectoryOptions & InstallMarketOptionsCurseforge) {
    const { file } = options
    const uris = [getCurseforgeFileUri(file)]
    const filePath = getFilePath(destination, file.fileName)

    const downloadUrls = [] as string[]
    if (file.downloadUrl) {
      downloadUrls.push(file.downloadUrl)
    } else {
      // Guess the download url if the file url is not provided by curseforge
      downloadUrls.push(...guessCurseforgeFileUrl(file.id, file.fileName))
    }
    uris.push(...downloadUrls)

    const snapshoted = await getSnapshotByUris(uris)

    if (snapshoted) {
      const [file, snapshot, metadata] = snapshoted
      return {
        file,
        snapshot,
        uris,
        path: resourceManager.getSnapshotPath(snapshot),
        metadata: {
          ...metadata,
          curseforge: {
            projectId: options.file.modId,
            fileId: options.file.id,
          },
        },
      }
    }

    const task = new DownloadTask({
      ...downloadOptions,
      url: downloadUrls,
      validator: resolveCurseforgeHash(file.hashes),
      destination: filePath,
      pendingFile: filePath + '.pending',
    }).setName('installCurseforgeFile', { modId: file.modId, fileId: file.id })
    await submit(task)

    return {
      uris,
      path: filePath,
      metadata: {
        curseforge: {
          projectId: options.file.modId,
          fileId: options.file.id,
        },
      },
    }
  }

  async function downloadModrinth(downloadOptions: DownloadBaseOptions, destination: string, options: InstallMarketOptionsModrinth) {
    const { version, file } = options
    const modrinthFile = file || getModrinthPrimaryFile(options.version)
    const filePath = getFilePath(destination, modrinthFile.filename)

    const uris = [modrinthFile.url] as string[]
    const isSingleFile = version.files.length === 1
    uris.push(getModrinthVersionFileUri({ project_id: version.project_id, id: version.id, filename: modrinthFile.filename }))
    if (isSingleFile) {
      uris.push(getModrinthVersionUri(version))
    }

    const snapshoted = await getSnapshotByUris(uris)

    if (snapshoted) {
      const [file, snapshot, metadata] = snapshoted
      return {
        file,
        snapshot,
        uris,
        path: resourceManager.getSnapshotPath(snapshot),
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

  app.registry.register(kMarketProvider, {
    installFile: async (options) => {
      const downloadOptions = await app.registry.get(kDownloadOptions)
      const result = options.market === 0
        ? await downloadModrinth(downloadOptions, options.directory, options)
        : await downloadCurseforge(downloadOptions, options.directory, options)
      const watched = resourceManager.getWatched(options.directory)
      if (watched) {
        watched.enqueue({
          filePath: result.path,
          metadata: result.metadata,
          uris: result.uris,
          icons: options.icon ? [options.icon] : undefined,
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
              icons: options.icon ? [options.icon] : undefined,
            }])
          }
        }
      }
      return result
    },
  })
}
