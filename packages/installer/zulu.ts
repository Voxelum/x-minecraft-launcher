import { download, DownloadBaseOptions, getDownloadBaseOptions } from '@xmcl/file-transfer'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createReadStream, createWriteStream } from 'fs'
import { stat, symlink, unlink } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { extract } from 'tar-stream'
import { createGunzip } from 'zlib'
import { onDownloadSingle, onProgress, Tracker, WithDownload, WithProgress } from './tracker'
import { ensureDir, ensureFile } from './utils'

/**
 * Tracker events for Zulu Java installation
 */
export interface ZuluTrackerEvents {
  'zulu-java.download': WithDownload<{   }>
  'zulu-java.extract': WithProgress<{ url: string }>
}

/**
 * Zulu JRE download information
 */
export interface ZuluJRE {
  /**
   * Features of this JRE build (e.g., javafx, musl, crac)
   */
  features: string[]
  /**
   * Target architecture (e.g., x64, arm64, ia32)
   */
  architecture: string
  /**
   * Target operating system (e.g., win32, linux, darwin)
   */
  os: string
  /**
   * SHA256 hash of the download file
   */
  sha256: string
  /**
   * Size of the download file in bytes
   */
  size: number
  /**
   * Download URL for the JRE
   */
  url: string
}

/**
 * Options for installing Zulu Java
 */
export interface InstallZuluJavaOptions extends DownloadBaseOptions {
  /**
   * The destination directory where Java will be installed
   */
  destination: string
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<ZuluTrackerEvents>

  abortSignal?: AbortSignal
}

/**
 * Install Zulu JRE from the provided JRE information
 * @param jre The Zulu JRE information containing download details
 * @param options Installation options including destination and download settings
 * @returns Promise that resolves when installation is complete
 */
export async function installZuluJava(
  jre: ZuluJRE,
  options: InstallZuluJavaOptions,
): Promise<void> {
  const { destination } = options
  const packedFile = join(destination, basename(jre.url))

  // Validate archive format before downloading
  if (!jre.url.endsWith('.tar.gz') && !jre.url.endsWith('.zip')) {
    throw new Error(`Unsupported archive format: ${jre.url}`)
  }

  // Track the download phase
  const downloadTracker = onDownloadSingle(options.tracker, 'zulu-java.download', {
    url: jre.url,
    size: jre.size,
  })

  // Download the JRE archive
  await download({
    url: jre.url,
    destination: packedFile,
    expectedTotal: jre.size,
    tracker: downloadTracker,
    ...getDownloadBaseOptions(options),
    signal: options.abortSignal,
  })

  try {
    // Track the extraction phase
    if (jre.url.endsWith('.tar.gz')) {
      // Handle tar.gz files (Linux and macOS)
      await extractTarGz(packedFile, destination, jre, options.tracker, options.abortSignal)
    } else if (jre.url.endsWith('.zip')) {
      // Handle zip files (Windows)
      await extractZip(packedFile, destination, jre, options.tracker, options.abortSignal)
    } else {
      throw new Error(`Unsupported archive format: ${jre.url}`)
    }
  } finally {
    // Clean up the downloaded archive
    try {
      await stat(packedFile).then(() => unlink(packedFile))
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Extract tar.gz archive (for Linux and macOS)
 */
async function extractTarGz(
  packedFile: string,
  destination: string,
  jre: ZuluJRE,
  tracker: Tracker<ZuluTrackerEvents> | undefined,
  abortSignal?: AbortSignal,
) {
  if (abortSignal?.aborted) {
    throw new Error('Extraction aborted')
  }

  const extractStream = extract()

  const allPipe = [
    pipeline(createReadStream(packedFile), createGunzip(), extractStream),
  ] as Promise<void>[]

  let first = ''
  let substring = 0
  const links = [] as {
    path: string
    linkTo: string
  }[]
  const progress = onProgress(tracker, 'zulu-java.extract', { url: jre.url })

  // Listen for abort signal
  const abortHandler = () => {
    extractStream.destroy(new Error('Extraction aborted'))
    allPipe.forEach((p) => p.catch(() => {}))
  }
  abortSignal?.addEventListener('abort', abortHandler)

  try {
    for await (const entry of extractStream) {
      if (abortSignal?.aborted) {
        throw new Error('Extraction aborted')
      }

      if (!first) {
        first = entry.header.name
        if (
          first.endsWith('/') &&
          jre.url.endsWith(entry.header.name.substring(0, entry.header.name.length - 1) + '.tar.gz')
        ) {
          // Skip the root directory if it matches the archive name
          substring = first.length
          continue
        }
      }

      const filePath = join(destination, entry.header.name.substring(substring))
      const size = entry.header.size ?? 0

      if (entry.header.type === 'directory') {
        await ensureDir(filePath)
      } else if (entry.header.linkname && entry.header.type === 'symlink') {
        links.push({
          path: join(destination, entry.header.linkname),
          linkTo: filePath,
        })
      } else if (entry.header.type === 'file') {
        progress.total += size
        await ensureDir(dirname(filePath))
        const writeStream = createWriteStream(filePath)

        // Track bytes written
        const originalWrite = writeStream.write.bind(writeStream)
        writeStream.write = function (chunk: any, ...args: any[]) {
          progress.progress += chunk.length ?? 0
          return originalWrite(chunk, ...args)
        }

        allPipe.push(pipeline(entry, writeStream))
      }
    }

    // Create symbolic links
    for (const link of links) {
      if (abortSignal?.aborted) {
        throw new Error('Extraction aborted')
      }
      try {
        await symlink(link.path, link.linkTo)
      } catch {
        // Ignore symlink errors on platforms that don't support them
      }
    }

    await Promise.all(allPipe)
  } finally {
    abortSignal?.removeEventListener('abort', abortHandler)
  }
}

/**
 * Extract zip archive (for Windows)
 */
async function extractZip(
  packedFile: string,
  destination: string,
  jre: ZuluJRE,
  tracker: Tracker<ZuluTrackerEvents> | undefined,
  abortSignal?: AbortSignal,
) {
  if (abortSignal?.aborted) {
    throw new Error('Extraction aborted')
  }

  const zipFile = await open(packedFile)

  // Listen for abort signal
  const abortHandler = () => {
    zipFile.close()
  }
  abortSignal?.addEventListener('abort', abortHandler)

  try {
    if (abortSignal?.aborted) {
      throw new Error('Extraction aborted')
    }

    const prefix = basename(jre.url).slice(0, -4) + '/'
    const entries = await readAllEntries(zipFile).then((ens) =>
      ens.filter((e) => e.fileName !== prefix && !e.fileName.endsWith('/')),
    )

    // Extract all entries
    const promises: Promise<void>[] = []
    const trackerProgress = onProgress(tracker, 'zulu-java.extract', { url: jre.url })
    for (const entry of entries) {
      abortSignal?.throwIfAborted()

      const relativePath = entry.fileName.startsWith(prefix)
        ? entry.fileName.substring(prefix.length)
        : entry.fileName
      const file = join(destination, relativePath)
      trackerProgress.total += entry.uncompressedSize

      const readStream = await openEntryReadStream(zipFile, entry)
      await ensureFile(file)
      const writeStream = createWriteStream(file)

      // Track bytes written
      const originalWrite = writeStream.write.bind(writeStream)
      writeStream.write = function (chunk: any, ...args: any[]) {
        trackerProgress.progress += chunk.length ?? 0
        onProgress(tracker, 'zulu-java.extract', { url: jre.url })
        return originalWrite(chunk, ...args)
      }

      promises.push(pipeline(readStream, writeStream))
    }
    await Promise.all(promises)
  } finally {
    abortSignal?.removeEventListener('abort', abortHandler)
    zipFile.close()
  }
}

/**
 * Select the best Zulu JRE from an array of options based on current platform and preferences
 * @param jres Array of available Zulu JRE options
 * @param platform Target platform (defaults to current platform)
 * @param arch Target architecture (defaults to current architecture)
 * @returns The best matching Zulu JRE or undefined if none found
 */
export function selectZuluJRE(
  jres: ZuluJRE[],
  platform: string = process.platform,
  arch: string = process.arch,
): ZuluJRE | undefined {
  // Normalize platform names
  const normalizedPlatform =
    platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux'

  // Normalize architecture names
  const normalizedArch =
    arch === 'x64'
      ? 'x64'
      : arch === 'arm64'
        ? 'arm64'
        : arch === 'ia32' || arch === 'x86'
          ? 'ia32'
          : arch

  // Filter by platform and architecture
  const targets = jres.filter(
    (jre) => jre.os === normalizedPlatform && jre.architecture === normalizedArch,
  )

  if (targets.length === 0) {
    return undefined
  }

  // Preference order: musl > javafx > default
  const withMusl = targets.find((jre) => jre.features.includes('musl'))
  if (withMusl) {
    return withMusl
  }

  const withJavafx = targets.find((jre) => jre.features.includes('javafx'))
  if (withJavafx) {
    return withJavafx
  }

  // Return the first available option
  return targets[0]
}
