import { MinecraftFolder, ResolvedVersion } from '@xmcl/core'
import { isNotNull } from '@xmcl/core/utils'
import { readFile, stat } from 'fs/promises'
import { DiagnoseOptions, Issue, diagnoseFile } from './diagnose'
import { type InstallFile, type InstallManifest } from './installManifest'
import { Tracker, WithDownload } from './tracker'
import { WithDiagnose } from './utils'
import { normalizeArray, resolveDownloadUrls } from './utils.browser'

export interface AssetsTrackerEvents {
  'assets.assets': WithDownload<{ count: number }>
  'assets.logConfig': WithDownload<{ url: string | string[] }>
  'assets.assetIndex': WithDownload<{ url: string | string[] }>
}

export interface AssetInfo {
  name: string
  hash: string
  size: number
}
/**
 * Default resource/assets url root
 */
export const DEFAULT_RESOURCE_ROOT_URL = 'https://resources.download.minecraft.net'

/**
 * Change the host url of assets download
 */
export interface AssetsOptions extends WithDiagnose {
  /**
   * The alternative assets host to download asset. It will try to use these host from the `[0]` to the `[assetsHost.length - 1]`
   */
  assetsHost?: string | string[]
  /**
   * Use hash as the assets index file name. Default is `false`
   */
  useHashForAssetsIndex?: boolean
  /**
   * The assets index download or url replacement
   */
  assetsIndexUrl?: string | string[] | ((version: ResolvedVersion) => string | string[])
  /**
   * The fetch implementation to use. Default is the global fetch
   */
  fetch?: typeof fetch
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<AssetsTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>

  strict?: boolean

  abortSignal?: AbortSignal
}

export function resolveAssetMetadataInstallFiles(
  version: ResolvedVersion,
  folder: MinecraftFolder,
  options: AssetsOptions = {},
): InstallFile[] {
  const files: InstallFile[] = []
  const logging = version.logging?.client?.file
  if (logging) {
    files.push({
      path: folder.getLogConfig(logging.id),
      urls: [logging.url],
      size: logging.size,
      checksum: logging.sha1 ? { algorithm: 'sha1', value: logging.sha1 } : undefined,
      validatedAt: options.timestamp,
    })
  }
  if (version.assetIndex) {
    files.push({
      path: folder.getPath(
        'assets',
        'indexes',
        (options.useHashForAssetsIndex ? version.assetIndex.sha1 : version.assets) + '.json',
      ),
      urls: resolveDownloadUrls(version.assetIndex.url, version, options.assetsIndexUrl),
      size: version.assetIndex.size,
      checksum: version.assetIndex.sha1
        ? { algorithm: 'sha1', value: version.assetIndex.sha1 }
        : undefined,
      validator: 'json',
      validatedAt: options.timestamp,
    })
  }
  return files
}

export function resolveAssetMetadataInstallManifest(
  version: ResolvedVersion,
  folder: MinecraftFolder,
  options: AssetsOptions = {},
): InstallManifest {
  const tasks: InstallManifest['tasks'] = [{
    id: 'asset-metadata-files',
    type: 'files',
    files: resolveAssetMetadataInstallFiles(version, folder, options),
  }]
  if (options.useHashForAssetsIndex && version.assetIndex && version.assetIndex.sha1 !== version.assets) {
    const source = folder.getPath('assets', 'indexes', `${version.assetIndex.sha1}.json`)
    const path = folder.getPath('assets', 'indexes', `${version.assets}.json`)
    tasks.push({
      id: 'asset-index-alias',
      type: 'materialize',
      dependsOn: ['asset-metadata-files'],
      operations: [{ type: 'link', source, path }],
      outputs: [{ path, validator: 'json' }],
    })
  }
  return { schemaVersion: 1, tasks }
}

export async function resolveAssetObjectInstallFiles(
  version: ResolvedVersion,
  folder: MinecraftFolder,
  options: AssetsOptions = {},
): Promise<InstallFile[]> {
  if (!version.assetIndex) return []
  const path = folder.getPath(
    'assets',
    'indexes',
    (options.useHashForAssetsIndex ? version.assetIndex.sha1 : version.assets) + '.json',
  )
  const index = await readFile(path, 'utf8').then((content) => JSON.parse(content) as {
    objects: Record<string, { hash: string; size: number }>
  })
  return resolveAssetInstallFiles(
    Object.entries(index.objects).map(([name, object]) => ({ name, ...object })),
    folder,
    options,
  )
}
/**
 * The asset issue represents a corrupted or missing minecraft asset file.
 * Use `resolveAssetInstallFiles` with an install runtime to repair it.
 */
export interface AssetIssue extends Issue {
  role: 'asset'

  /**
   * The problematic asset
   */
  asset: { name: string; hash: string; size: number }
}
/**
 * Diagnose assets currently installed.
 * @param assetObjects The assets object metadata to check
 * @param minecraft The minecraft location
 * @returns The diagnose report
 */
export async function diagnoseAssets(
  assetObjects: AssetInfo[],
  minecraft: MinecraftFolder,
  options?: DiagnoseOptions,
): Promise<Array<{ name: string; hash: string; size: number }>> {
  const signal = options?.signal
  const issues = await Promise.all(
    assetObjects.map(async (asset) => {
      const assetPath = minecraft.getAsset(asset.hash)
      const { hash, size, name: filename } = asset

      if (options?.strict || options?.timestamp !== undefined) {
        const issue = await diagnoseFile(
          {
            file: assetPath,
            expectedChecksum: hash,
            role: 'asset',
            hint: 'Reinstall the asset files.',
          },
          options,
        )
        if (issue) {
          return asset
        }
      } else {
        // non-strict mode might be faster
        const { size: realSize } = await stat(assetPath).catch(() => ({ size: -1 }))
        if (signal?.aborted) return
        if (realSize !== size) {
          const issue = await diagnoseFile(
            {
              file: assetPath,
              expectedChecksum: hash,
              role: 'asset',
              hint: 'Reinstall the asset files.',
            },
            options,
          )
          if (issue) {
            return asset
          }
        }
      }

      return undefined
    }),
  )
  return issues.filter(isNotNull)
}

export async function diagnoseVersionAssets(
  version: ResolvedVersion,
  options: DiagnoseOptions & Pick<AssetsOptions, 'useHashForAssetsIndex'> = {},
): Promise<{
  assetsIndex?: ResolvedVersion['assetIndex']
  assets?: AssetInfo[]
} | undefined> {
  if (!version.assetIndex) return undefined
  const folder = MinecraftFolder.from(version.minecraftDirectory)
  const index = version.assetIndex
  const path = folder.getPath(
    'assets',
    'indexes',
    (options.useHashForAssetsIndex ? index.sha1 : version.assets) + '.json',
  )
  const indexIssue = await diagnoseFile(
    {
      file: path,
      expectedChecksum: index.sha1,
      role: 'assetIndex',
      hint: 'Reinstall the asset index.',
    },
    options,
  )
  if (indexIssue) return { assetsIndex: index }
  const assetIndex = await readFile(path, 'utf8')
    .then((content) => JSON.parse(content) as { objects: Record<string, { hash: string; size: number }> })
    .catch(() => undefined)
  if (!assetIndex) return { assetsIndex: index }
  const assets = await diagnoseAssets(
    Object.entries(assetIndex.objects).map(([name, value]) => ({ name, ...value })),
    folder,
    options,
  )
  return assets.length > 0 ? { assets } : undefined
}

export function resolveAssetInstallFiles(
  assets: AssetInfo[],
  folder: MinecraftFolder,
  options: AssetsOptions = {},
): InstallFile[] {
  const hosts = normalizeArray(options.assetsHost || DEFAULT_RESOURCE_ROOT_URL)
  const urls = hosts.length > 1 ? hosts.concat(hosts) : hosts
  return assets.map((asset) => {
    const head = asset.hash.substring(0, 2)
    return {
      path: folder.getAsset(asset.hash),
      urls: urls.map((host) => `${host}/${head}/${asset.hash}`),
      size: asset.size,
      checksum: { algorithm: 'sha1', value: asset.hash },
      trustExistingSize: true,
      validatedAt: options.timestamp,
    }
  })
}
