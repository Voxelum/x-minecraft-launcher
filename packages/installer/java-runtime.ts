import { Platform } from '@xmcl/core'
import {
  download,
  DownloadBaseOptions,
  downloadMultiple,
  getDownloadBaseOptions,
} from '@xmcl/file-transfer'
import { createHash } from 'crypto'
import { link, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { diagnoseFile } from './diagnose'
import {
  FileEntry,
  JavaRuntimeManifest,
  JavaRuntimes,
  JavaRuntimeTarget,
  JavaRuntimeTargetType,
} from './java-runtime.browser'
import { Tracker, onDownloadMultiple, onDownloadSingle, WithDownload } from './tracker'
import { ensureDir } from './utils'

export interface JavaRuntimeTrackerEvents {
  'java-runtime.json': WithDownload<{ target: string }>
  'java-runtime.file': WithDownload<{ path: string }>
}

export {
  DEFAULT_RUNTIME_ALL_URL,
  fetchJavaRuntimeManifest,
  JavaRuntimeTargetType,
} from './java-runtime.browser'
export type {
  DirectoryEntry,
  DownloadInfo,
  Entry,
  FileEntry,
  JavaRuntimeManifest,
  JavaRuntimes,
  JavaRuntimeTarget,
  JavaRuntimeTargets,
  JreRuntimeEntry,
  LinkEntry,
} from './java-runtime.browser'

function normalizeUrls(url: string, fileHost?: string | string[]): string[] {
  if (!fileHost) {
    return [url]
  }
  if (typeof fileHost === 'string') {
    const u = new URL(url)
    u.hostname = fileHost
    const result = u.toString()
    if (result !== url) {
      return [result, url]
    }
    return [result]
  }
  const result = fileHost.map((host) => {
    const u = new URL(url)
    u.hostname = host
    return u.toString()
  })

  if (result.indexOf(url) === -1) {
    result.push(url)
  }

  return result
}

export interface FetchJavaRuntimeManifestOptions extends DownloadBaseOptions {
  /**
   * The alternative download host for the file
   */
  apiHost?: string | string[]
  /**
   * The url of the all runtime json
   */
  url?: string
  /**
   * The platform to install. It will be auto-resolved by default.
   * @default getPlatform()
   */
  platform?: Platform
  /**
   * The install java runtime type
   * @default InstallJavaRuntimeTarget.Next
   */
  target?: JavaRuntimeTargetType | string
  /**
   * The index manifest of the java runtime. If this is not presented, it will fetch by platform and all platform url.
   */
  manifestIndex?: JavaRuntimes
  /**
   * Custom fetch function
   */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  /**
   * Abort signal for fetch
   */
  signal?: AbortSignal
}

async function downloadFiles(
  destination: string,
  options: InstallJavaRuntimeWithJsonOptions | InstallJavaRuntimeOptions,
  manifest: JavaRuntimeManifest,
) {
  const unpackLzma = options.unpackLzma

  // First, diagnose all files in parallel
  const fileEntries = Object.entries(manifest.files).filter(
    ([file, entry]) => entry.type === 'file',
  )

  const diagnoseResults = await Promise.all(
    fileEntries.map(async ([file, entry]) => {
      const fEntry = entry as FileEntry
      const useLzma = unpackLzma && fEntry.downloads.lzma
      const rawDest = join(destination, file)

      let needsDownload = false
      let downloadInfo = fEntry.downloads.raw
      let dest = rawDest
      let urls = normalizeUrls(downloadInfo.url, options.apiHost)
      let hash = downloadInfo.sha1
      let needsUnpack = false

      if (useLzma) {
        // For lzma mode, first check if the decompressed (raw) file already exists and is valid
        const rawIssue = await diagnoseFile(
          {
            file: rawDest,
            expectedChecksum: fEntry.downloads.raw.sha1,
            role: 'java-runtime-file',
            hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`,
          },
          { signal: options.signal, checksum: options.checksum },
        )

        if (!rawIssue) {
          // Decompressed file exists and is valid, no need to download
          needsDownload = false
        } else {
          // Decompressed file is missing or corrupted, need to download lzma
          downloadInfo = fEntry.downloads.lzma!
          dest = rawDest + '.lzma'
          urls = normalizeUrls(downloadInfo.url, options.apiHost)
          hash = downloadInfo.sha1
          needsUnpack = true

          // Check if lzma file already exists and is valid
          const lzmaIssue = await diagnoseFile(
            {
              file: dest,
              expectedChecksum: hash,
              role: 'java-runtime-file',
              hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`,
            },
            { signal: options.signal, checksum: options.checksum },
          )

          needsDownload = !!lzmaIssue
        }

        return {
          file,
          dest,
          rawDest,
          urls,
          hash,
          needsDownload,
          needsUnpack,
          issue: needsDownload ? { type: 'missing' as const, file: dest } : undefined,
        }
      } else {
        // Regular mode, just check the raw file
        const issue = await diagnoseFile(
          {
            file: dest,
            expectedChecksum: hash,
            role: 'java-runtime-file',
            hint: `Problem on java runtime file ${file}! Please consider to reinstall the java runtime.`,
          },
          { signal: options.signal, checksum: options.checksum },
        )

        return {
          file,
          dest,
          rawDest,
          urls,
          hash,
          needsDownload: !!issue,
          needsUnpack: false,
          issue,
        }
      }
    }),
  )

  // Check for issues and prepare download list
  const issues = diagnoseResults.filter((r) => r.issue)
  if (issues.length > 0 && options.diagnose) {
    const errors = issues.map((r) => {
      const issue = r.issue!
      const receivedChecksum = issue.type === 'corrupted' ? issue.receivedChecksum : 'missing'
      return `${r.file} is ${issue.type}: expected checksum ${r.hash}, got ${receivedChecksum}`
    })
    throw new Error(`Java runtime files validation failed:\n${errors.join('\n')}`)
  }

  const filesToDownload = diagnoseResults
    .filter((r) => r.needsDownload)
    .map((r) => ({
      url: r.urls,
      destination: r.dest,
    }))

  // Only download files that need to be downloaded
  if (filesToDownload.length > 0) {
    await downloadMultiple({
      options: filesToDownload,
      tracker: onDownloadMultiple(options.tracker, 'java-runtime.file', { path: destination }),
      ...getDownloadBaseOptions(options),
    })
  }

  // Unpack lzma files if needed
  if (unpackLzma) {
    await Promise.all(
      diagnoseResults
        .filter((r) => r.needsUnpack && r.needsDownload)
        .map((r) => unpackLzma(r.dest, r.rawDest)),
    )
  }
  await Promise.all(
    Object.entries(manifest.files)
      .filter(([file, entry]) => entry.type !== 'file')
      .map(async ([file, entry]) => {
        const dest = join(destination, file)
        if (entry.type === 'directory') {
          await ensureDir(dest)
        } else if (entry.type === 'link') {
          await link(dest, join(dirname(dest), entry.target)).catch(() => {})
        }
      }),
  )
}

interface InstallJavaRuntimeBaseOptions extends DownloadBaseOptions {
  /**
   * The alternative download host for the file
   */
  apiHost?: string | string[]
  /**
   * The destination of this installation
   */
  destination: string
  /**
   * The unpacker for lzma file
   */
  unpackLzma?: (lzmaFile: string, destinationFile: string) => Promise<void>
  /**
   * Whether to diagnose the installation. If true, will throw error instead of fixing.
   */
  diagnose?: boolean
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>
  /**
   * Abort signal
   */
  signal?: AbortSignal
}

export interface InstallJavaRuntimeOptions extends InstallJavaRuntimeBaseOptions {
  /**
   * The actual manfiest to install.
   */
  manifest: JavaRuntimeManifest

  tracker?: Tracker<JavaRuntimeTrackerEvents>
}

/**
 * Install java runtime from java runtime manifest
 * @param options The options to install java runtime
 */
export async function installJavaRuntime(options: InstallJavaRuntimeOptions): Promise<void> {
  const destination = options.destination
  const manifest = options.manifest
  await downloadFiles(destination, options, manifest)
}

export interface InstallJavaRuntimeWithJsonOptions extends InstallJavaRuntimeBaseOptions {
  /**
   * The actual manifest metadata.
   */
  target: JavaRuntimeTarget

  tracker?: Tracker<JavaRuntimeTrackerEvents>

  unpackLzma?: (lzmaFile: string, destinationFile: string) => Promise<void>
}

/**
 * Install java runtime from java runtime manifest
 * @param options The options to install java runtime
 */
export async function installJavaRuntimeWithJson(
  options: InstallJavaRuntimeWithJsonOptions,
): Promise<void> {
  const destination = options.destination
  const target = options.target
  const jsonPath = join(destination, 'manifest.json')

  const readManifest = async () => {
    const content = await readFile(jsonPath)
    return JSON.parse(content.toString()) as JavaRuntimeManifest
  }

  // Diagnose the manifest.json first
  const manifestIssue = await diagnoseFile(
    {
      file: jsonPath,
      expectedChecksum: target.manifest.sha1,
      role: 'java-runtime-manifest',
      hint: 'Problem on java runtime manifest.json! Please consider to reinstall the java runtime.',
    },
    { signal: options.signal, checksum: options.checksum },
  )

  if (manifestIssue) {
    if (options.diagnose) {
      throw new Error(
        `Java runtime manifest is ${manifestIssue.type}: expected checksum ${target.manifest.sha1}, got ${manifestIssue.receivedChecksum}`,
      )
    }
    // Download the manifest
    const downloadOptions = getDownloadBaseOptions(options)
    const manifestUrl = normalizeUrls(target.manifest.url, options.apiHost)
    await download({
      destination: jsonPath,
      url: manifestUrl,
      ...downloadOptions,
      tracker: onDownloadSingle(options.tracker, 'java-runtime.json', {
        target: target.version.name,
      }),
    })
  } 
  const manifest = await readManifest()
  await downloadFiles(destination, options, manifest)
}
