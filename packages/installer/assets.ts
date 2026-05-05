import { MinecraftFolder, ResolvedVersion } from '@xmcl/core'
import { isNotNull } from '@xmcl/core/utils'
import {
  DownloadBaseOptions,
  download,
  downloadMultiple,
  getDownloadBaseOptions,
} from '@xmcl/file-transfer'
import { link } from 'fs'
import { readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { DiagnoseOptions, Issue, diagnoseFile } from './diagnose'
import { InstallError } from './error'
import { Tracker, WithDownload, onDownloadMultiple, onDownloadSingle } from './tracker'
import { WithDiagnose, ensureDir } from './utils'
import { doFetch, normalizeArray, resolveDownloadUrls } from './utils.browser'

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
export interface AssetsOptions extends DownloadBaseOptions, WithDiagnose {
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

/**
 * Install or check the assets to resolved version
 *
 * @param version The target version
 * @param options The option to replace assets host url
 */
export async function installAssets(
  version: ResolvedVersion,
  options: AssetsOptions = {},
): Promise<ResolvedVersion> {
  const folder = MinecraftFolder.from(version.minecraftDirectory)
  if (version.logging?.client?.file) {
    const file = version.logging.client.file

    await diagnoseFile(
      {
        file: folder.getLogConfig(file.id),
        expectedChecksum: file.sha1,
        role: 'log config',
        hint: 'Problem on log config! Please consider to use Installer.installAssets to fix.',
      },
      { signal: options.abortSignal, checksum: options.checksum },
    )
      .catch(async (e) => {
        if (options.diagnose) {
          throw e
        }
        await download({
          url: [file.url],
          destination: folder.getLogConfig(file.id),
          expectedTotal: file.size,
          ...getDownloadBaseOptions(options),
          tracker: onDownloadSingle(options.tracker, 'assets.logConfig', { url: file.url }),
          signal: options.abortSignal,
        })
      })
      .catch(() => {})
  }

  if (!version.assetIndex) {
    throw new Error('Cannot install assets for version without assetIndex')
  }

  const assetIndexInfo = version.assetIndex

  interface AssetIndex {
    objects: {
      [key: string]: {
        hash: string
        size: number
      }
    }
  }

  const jsonPath = folder.getPath(
    'assets',
    'indexes',
    (options.useHashForAssetsIndex ? assetIndexInfo.sha1 : version.assets) + '.json',
  )
  const fetchAssetIndex = async () => {
    const urls = resolveDownloadUrls(assetIndexInfo.url, version, options.assetsIndexUrl)
    for (const url of urls) {
      try {
        const response = await doFetch(options, url, {
          signal: options.abortSignal,
        })
        if (!response.ok) {
          continue
        }
        const json = (await response.json()) as any
        await writeFile(jsonPath, JSON.stringify(json))
        return json as AssetIndex
      } catch {
        // ignore
      }
    }
    // throw new InstallAssetIndexError(assetIndexInfo)

    throw new InstallError({
      assetsIndex: assetIndexInfo,
    })
  }

  const readJson = async () => readFile(jsonPath, 'utf-8').then((b) => JSON.parse(b) as AssetIndex)

  await ensureDir(folder.getPath('assets', 'objects'))
  const assetIndex: AssetIndex = await readJson().catch(async (e) => {
    if (options.diagnose) {
      throw new InstallError(
        {
          assetsIndex: assetIndexInfo,
        },
        `Install asset index from ${assetIndexInfo.id} (${assetIndexInfo.url}) failed`,
        e,
      )
    }
    await download({
      url: resolveDownloadUrls(assetIndexInfo.url, version, options.assetsIndexUrl),
      destination: jsonPath,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadSingle(options.tracker, 'assets.assetIndex', { url: assetIndexInfo.url }),
      signal: options.abortSignal,
    })
    const result = await readJson().catch(fetchAssetIndex)

    await promisify(link)(
      folder.getPath('assets', 'indexes', assetIndexInfo.sha1 + '.json'),
      folder.getPath('assets', 'indexes', version.assets + '.json'),
    ).catch(() => {})

    return result
  })

  const { objects } = assetIndex
  const objectArray = Object.keys(objects).map((k) => ({ name: k, ...objects[k] }))

  await installResolvedAssets(objectArray, folder, version.id, options)

  return version
}
/**
 * The asset issue represents a corrupted or missing minecraft asset file.
 * You can use `Installer.installResolvedAssets` to fix this.
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
async function diagnoseAssets(
  assetObjects: AssetInfo[],
  minecraft: MinecraftFolder,
  options?: DiagnoseOptions,
): Promise<Array<{ name: string; hash: string; size: number }>> {
  const signal = options?.signal
  const issues = await Promise.all(
    assetObjects.map(async (asset) => {
      const assetPath = minecraft.getAsset(asset.hash)
      const { hash, size, name: filename } = asset

      if (options?.strict) {
        const issue = await diagnoseFile(
          {
            file: assetPath,
            expectedChecksum: hash,
            role: 'asset',
            hint: 'Problem on asset! Please consider to use Installer.installAssets to fix.',
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
              hint: 'Problem on asset! Please consider to use Installer.installAssets to fix.',
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

/**
 * Only install several resolved assets.
 * @param assets The assets to install
 * @param folder The minecraft folder
 * @param version The version string for tracking
 * @param options The asset option
 */
export async function installResolvedAssets(
  assets: AssetInfo[],
  folder: MinecraftFolder,
  version: string,
  options: AssetsOptions = {},
) {
  await diagnoseAssets(assets, folder, {
    signal: options.abortSignal,
    checksum: options.checksum,
    strict: options.strict,
  }).then(async (assets) => {
    if (assets.length === 0) {
      return
    }
    if (options.diagnose) {
      throw new InstallError({
        assets,
      })
    }
    const assetsHosts = normalizeArray(options.assetsHost || DEFAULT_RESOURCE_ROOT_URL)
    if (assetsHosts.length > 1) {
      assetsHosts.push(
        ...assetsHosts
      )
    }
    const results = await downloadMultiple({
      options: assets.map((asset) => {
        const { hash, size } = asset
        const head = hash.substring(0, 2)
        const dir = folder.getPath('assets', 'objects', head)
        const file = join(dir, hash)
        const urls = assetsHosts.map((h) => `${h}/${head}/${hash}`)
        return {
          url: urls,
          destination: file,
          expectedTotal: size,
        }
      }),
      signal: options.abortSignal,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadMultiple(options.tracker, 'assets.assets', { count: assets.length }),
    })

    const unfixedIssues = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r, index) => {
        return { reason: r.reason, asset: assets[index] }
      })
    if (unfixedIssues.length > 0) {
      if (options.abortSignal?.aborted && options.abortSignal.reason) {
        throw options.abortSignal.reason
      }
      throw new InstallError(
        {
          assets: unfixedIssues.map((i) => i.asset),
        },
        '',
        new AggregateError(unfixedIssues.map((i) => i.reason)),
      )
    }
  })
}
