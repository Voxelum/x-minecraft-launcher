import {
  createJavaRuntimeManifestInstallWorkflow,
  createJavaArchiveInstallWorkflow,
  runInstallWorkflow,
  onDownloadMultiple,
  resolveJava as inspectJava,
  type InstallWorkflow,
  type JavaRuntimeTrackerEvents,
  type JavaRuntimeManifest,
} from '@xmcl/installer'
import type { InstallJavaTask, Java } from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import {
  ensureDir,
  mkdtemp,
  pathExists,
  readJson,
  readdir,
  remove,
  rename,
  writeJson,
} from 'fs-extra'
import { createHash, randomUUID } from 'crypto'
import { rmdir } from 'fs/promises'
import { dirname, join, relative, resolve, sep } from 'path'
import { type LauncherApp, type PathResolver } from '~/app'
import { type TaskInstance } from '~/infra'
import {
  getOrCreateJavaRuntimeIdentity,
  writeJavaReplacementJournal,
} from './javaReplacementJournal'
import { getManagedJavaComponent } from './java'
import { javaRuntimeLockKey, withJavaRuntimeLock } from './javaRuntimeLock'
import { getJavaRuntimeVersionFromName } from './javaInstallUtils'
import { javaStagingPrefix } from './javaStaging'
import type { InstallManifestService } from '~/install/InstallManifestService'
import { getTracker } from '~/util/taskHelper'
import {
  getJavaRuntimeDestination,
  getSupportedJavaRuntimes,
  type JavaRuntime,
} from './javaInstallUtils'

type JavaInstallTrackerEvents = JavaRuntimeTrackerEvents

interface JavaVendor {
  name: string
  uid?: string
  [key: string]: unknown
}

interface JavaVersion {
  version: string
  recommended?: boolean
  releaseTime?: string
  sha256?: string
  [key: string]: unknown
}

interface JavaRuntimeOption {
  version: string
  runtimeUrl: string
  displayVersion: string
  name: string
  vendor: string
  packageType?: string
  releaseTime?: string
  path: string
}

const vendorNames: Record<string, string> = {
  'net.minecraft.java': 'mojang',
  'com.azul.java': 'azul',
  'net.adoptium.java': 'eclipse',
  'com.ibm.java': 'ibm',
}

const prismMetatUrl = 'https://meta.prismlauncher.org/v1'

const prismMetadataRequests = new Map<
  string,
  Promise<{
    buffer: Buffer<ArrayBuffer>
    metadata: unknown
  }>
>()

async function getJavaMetaCache(getPath: PathResolver, uid: string) {
  try {
    const cache: {
      etag: string
      expiresAt: number
      buffer: string
      metadata: unknown
    } = await readJson(getPath('meta', uid.replace(prismMetatUrl + '/', '')))

    const etag = cache.etag
    const expiresAt = cache.expiresAt
    const buffer = Buffer.from(cache.buffer)
    const metadata = cache.metadata

    return { etag, expiresAt, buffer, metadata }
  } catch {
    return undefined
  }
}

async function setJavaMetaCache(
  getPath: PathResolver,
  uid: string,
  etag: string,
  expiresAt: number,
  buffer: Buffer<ArrayBuffer>,
  metadata: unknown,
) {
  const path = getPath('meta', uid.replace(prismMetatUrl + '/', ''))
  await ensureDir(dirname(path))
  await writeJson(path, { etag, expiresAt, metadata, buffer }, { spaces: 2 })
}

async function updateJavaMetaCacheExpiry(getPath: PathResolver, uid: string, expiresAt: number) {
  const metacache = await getJavaMetaCache(getPath, uid)

  if (!metacache) return

  await setJavaMetaCache(
    getPath,
    uid,
    metacache.etag,
    expiresAt,
    metacache.buffer,
    metacache.metadata,
  )
}

function getExpiresAt(headers: Headers, fallback = 600): number {
  const cacheControl = headers.get('cache-control') ?? ''
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i)

  const maxAge = match ? Number(match[1]) : fallback
  const age = Number(headers.get('age') ?? 0)

  return Date.now() + Math.max(0, maxAge - age) * 1000
}

/** Fetch Prism metadata, using the cache unless a fresh update check is requested. */
async function fetchPrismMetadata(
  app: LauncherApp,
  getPath: PathResolver,
  url: string,
  force = false,
): Promise<{
  buffer: Buffer<ArrayBuffer>
  metadata: unknown
}> {
  if (!force) {
    const pending = prismMetadataRequests.get(url)
    if (pending) return pending
  }

  const request = (async () => {
    const cached = await getJavaMetaCache(getPath, url)

    if (!force && cached && Date.now() < cached.expiresAt) {
      return { buffer: cached.buffer, metadata: cached.metadata }
    }

    const headers: Record<string, string> = {}

    if (force) {
      headers['Cache-Control'] = 'no-cache'
    } else if (cached?.etag) {
      headers['If-None-Match'] = cached.etag
    }

    const response = await app.fetch(url, {
      headers,
      signal: force ? AbortSignal.timeout(10_000) : undefined,
    })

    // not modified
    if (response.status === 304 && cached) {
      await updateJavaMetaCacheExpiry(getPath, url, getExpiresAt(response.headers))
      return { buffer: cached.buffer, metadata: cached.metadata }
    }

    if (!response.ok) throw new Error(`Failed to fetch Java metadata (${response.status})`)

    const etag = response.headers.get('etag') ?? ''
    const expiresAt = getExpiresAt(response.headers)
    const value = Buffer.from(await response.arrayBuffer())
    const metadata: unknown = JSON.parse(value.toString('utf8'))

    await setJavaMetaCache(getPath, url, etag, expiresAt, value, metadata)
    return { buffer: value, metadata }
  })()

  prismMetadataRequests.set(url, request)

  try {
    return await request
  } finally {
    if (prismMetadataRequests.get(url) === request) prismMetadataRequests.delete(url)
  }
}

export async function getSupportedMajorJavaVersions(
  app: LauncherApp,
  getPath: PathResolver,
): Promise<number[]> {
  const majorVersions = await listMajorJavaVersionsFromVendor(app, getPath, 'net.minecraft.java')
  return majorVersions.map((version) => {
    const major = version.version.replace('java', '')
    return Number(major)
  })
}

export async function listJavaVendors(
  app: LauncherApp,
  getPath: PathResolver,
  force = false,
): Promise<JavaVendor[]> {
  const data = await fetchPrismMetadata(app, getPath, `${prismMetatUrl}/index.json`, force)
  const metadata = data.metadata as { packages?: JavaVendor[] }

  if (!Array.isArray(metadata.packages)) {
    throw new Error(`Prism index does not contain packages`)
  }

  const vendors = metadata.packages.filter((item) => item.name === 'Java Runtimes')
  return vendors
}

export async function listMajorJavaVersionsFromVendor(
  app: LauncherApp,
  getPath: PathResolver,
  vendor: string,
  force = false,
): Promise<JavaVersion[]> {
  if (!vendorNames[vendor]) throw new Error(`Unsupported Java vendor: ${vendor}`)

  const data = await fetchPrismMetadata(
    app,
    getPath,
    `${prismMetatUrl}/${vendor}/index.json`,
    force,
  )
  const metadata = data.metadata as { versions?: JavaVersion[] }

  if (!Array.isArray(metadata.versions)) {
    throw new Error(`Prism index does not contain versions`)
  }

  return metadata.versions
}

/** List every runtime build in a version manifest that matches this machine. */
export async function listJavaRuntimeOptions(
  app: LauncherApp,
  getPath: PathResolver,
  vendor: string,
  version: string,
  metadataSha256?: string,
  force = false,
): Promise<JavaRuntimeOption[]> {
  if (!/^[a-z0-9.-]+$/.test(vendor) || !/^[a-zA-Z0-9.+_-]+$/.test(version)) {
    throw new Error('Invalid Java vendor or version')
  }
  const expectedVendor = vendorNames[vendor]
  if (!expectedVendor) throw new Error(`Unsupported Java vendor: ${vendor}`)

  const manifestUrl = `${prismMetatUrl}/${vendor}/${encodeURIComponent(version)}.json`
  const data = await fetchPrismMetadata(app, getPath, manifestUrl, force)

  if (metadataSha256) {
    if (!/^[a-f0-9]{64}$/i.test(metadataSha256)) throw new Error('Invalid Prism metadata checksum')

    const actualHash = createHash('sha256').update(data.buffer).digest('hex')

    if (actualHash.toLowerCase() !== metadataSha256.toLowerCase()) {
      throw new Error(`Java runtime metadata checksum mismatch for ${vendor} ${version}`)
    }
  }

  const metadata = data.metadata as { runtimes?: JavaRuntime[] }

  if (!Array.isArray(metadata.runtimes)) {
    throw new Error(`Prism metadata for ${vendor} ${version} does not contain Java runtimes`)
  }

  const options = getSupportedJavaRuntimes(metadata.runtimes, expectedVendor, app.platform).map(
    (runtime) => {
      const versionName = runtime.version?.major
        ? `${[runtime.version.major, runtime.version.minor, runtime.version.security].filter((value) => value !== undefined).join('.')}${runtime.version.build !== undefined ? `+${runtime.version.build}` : ''}`
        : runtime.version?.name

      const displayVersion = versionName || runtime.name

      return {
        version,
        runtimeUrl: runtime.url,
        displayVersion,
        name: runtime.name,
        vendor: runtime.vendor,
        packageType: runtime.packageType,
        releaseTime: runtime.releaseTime,
        path: getJavaRuntimeDestination(getPath('jre'), runtime.name),
      }
    },
  )

  const unique = new Map<string, JavaRuntimeOption>()
  for (const option of options) unique.set(`${option.name}_${option.runtimeUrl}`, option)

  return [...unique.values()].sort(
    (a, b) =>
      b.displayVersion.localeCompare(a.displayVersion, undefined, { numeric: true }) ||
      (b.releaseTime ?? '').localeCompare(a.releaseTime ?? ''),
  )
}

async function findJavaExecutable(
  root: string,
  platform: LauncherApp['platform'],
): Promise<string | undefined> {
  const preferred = platform.os === 'windows' ? ['java.exe', 'javaw.exe'] : ['java']
  const matches: string[] = []
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 8) return

    let entries

    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        await visit(path, depth + 1)
      } else if (
        (entry.isFile() || entry.isSymbolicLink()) &&
        preferred.includes(entry.name.toLowerCase()) &&
        /(?:^|[\\/])bin[\\/]/i.test(path)
      ) {
        matches.push(path)
      }
    }
  }

  await visit(root, 0)
  return preferred
    .map((name) => matches.find((path) => path.toLowerCase().endsWith(name)))
    .find(Boolean)
}

/** Remove a single archive wrapper without discarding sibling files or macOS bundle contents. */
async function flattenJavaArchive(staging: string, executable: string): Promise<string> {
  const parts = relative(staging, executable).split(sep)
  const wrappedHome = parts.length === 3 && parts[1] === 'bin'
  const wrappedBundle = parts.length === 5 &&
    parts[1] === 'Contents' && parts[2] === 'Home' && parts[3] === 'bin'
  if (!wrappedHome && !wrappedBundle) return executable

  const entries = await readdir(staging, { withFileTypes: true })
  if (entries.length !== 1 || !entries[0].isDirectory() || entries[0].name !== parts[0]) {
    return executable
  }
  const extracted = join(dirname(staging), 'archive-root')
  await rename(join(staging, parts[0]), extracted)
  await rmdir(staging)
  await rename(extracted, staging)
  return join(staging, ...parts.slice(1))
}

/** Prepare and activate a new runtime, removing it if activation fails. */
export async function withStagedJavaRuntime<T>(
  destination: string,
  prepare: (staging: string) => Promise<void>,
  activate: () => Promise<T>,
): Promise<T> {
  const root = dirname(destination)
  await ensureDir(root)
  const temporary = await mkdtemp(javaStagingPrefix(root))
  const staging = join(temporary, 'runtime')
  let installed = false
  try {
    // Prepare and validate away from existing runtimes before publishing the directory.
    await prepare(staging)
    if (await pathExists(destination)) {
      throw new Error(`Java installation destination already exists: ${destination}`)
    }
    await rename(staging, destination)
    installed = true
    return await activate()
  } catch (error) {
    if (installed) {
      try {
        await remove(destination)
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `Java installation cleanup failed at ${destination}`,
        )
      }
    }
    throw error
  } finally {
    await remove(temporary)
  }
}

/** Install and verify a vendor runtime, journaling replacement details when requested. */
export async function installJavaRuntime(
  app: LauncherApp,
  getPath: PathResolver,
  installer: InstallManifestService,
  task: TaskInstance<InstallJavaTask>,
  vendor: string,
  version: string,
  majorVersion: number,
  resolveJava: (path: string) => Promise<Java | undefined>,
  metadataSha256?: string,
  runtimeUrl?: string,
  replacement?: { javaPath: string; runtimePath: string },
): Promise<Java & { replacementIdentity?: string }> {
  if (!/^[a-z0-9.-]+$/.test(vendor) || !/^[a-zA-Z0-9.+_-]+$/.test(version)) {
    throw new Error('Invalid Java vendor or version')
  }
  const expectedVendor = vendorNames[vendor]
  if (!expectedVendor) throw new Error(`Unsupported Java vendor: ${vendor}`)

  const manifestUrl = `${prismMetatUrl}/${vendor}/${encodeURIComponent(version)}.json`
  const data = await fetchPrismMetadata(app, getPath, manifestUrl)

  if (metadataSha256) {
    if (!/^[a-f0-9]{64}$/i.test(metadataSha256)) throw new Error('Invalid Prism metadata checksum')

    const actualHash = createHash('sha256').update(data.buffer).digest('hex')

    if (actualHash.toLowerCase() !== metadataSha256.toLowerCase()) {
      throw new Error(`Java runtime metadata checksum mismatch for ${vendor} ${version}`)
    }
  }

  const metadata = data.metadata as { runtimes?: JavaRuntime[] }

  if (!Array.isArray(metadata.runtimes)) {
    throw new Error(`Prism metadata for ${vendor} ${version} does not contain Java runtimes`)
  }

  const runtime = getSupportedJavaRuntimes(metadata.runtimes, expectedVendor, app.platform)
    .filter((item) => !runtimeUrl || item.url === runtimeUrl)
    .sort(
      (a, b) =>
        Number((b.packageType || '').toLowerCase().includes('jre')) -
        Number((a.packageType || '').toLowerCase().includes('jre')),
    )[0]
  if (!runtime)
    throw new Error(
      `No ${app.platform.os}/${app.platform.arch} runtime is available for ${vendor} ${version}`,
    )
  if (
    !runtime.url ||
    !runtime.url.startsWith('https://') ||
    !runtime.checksum?.hash ||
    !runtime.checksum.type
  ) {
    throw new Error(`Incomplete download metadata for ${vendor} ${version}`)
  }

  const checksumAlgorithm = runtime.checksum.type.toLowerCase().replace('-', '')
  const checksumHash = runtime.checksum.hash

  if (!['sha1', 'sha256'].includes(checksumAlgorithm)) {
    throw new Error(`Unsupported runtime checksum: ${runtime.checksum.type}`)
  }

  const canonicalDestination = getJavaRuntimeDestination(getPath('jre'), runtime.name)
  // Never overwrite an existing runtime, including when metadata reuses its name.
  const component =
    (await pathExists(canonicalDestination))
      ? `${runtime.name}-xmcl-${randomUUID().replace(/-/g, '')}`
      : runtime.name
  const destination = getJavaRuntimeDestination(getPath('jre'), component)
  let replacementIdentity: string | undefined
  let manifest: JavaRuntimeManifest | undefined
  if (runtime.downloadType === 'manifest') {
    const manifestResponse = await app.fetch(runtime.url, {})

    if (!manifestResponse.ok)
      throw new Error(`Failed to fetch runtime manifest (${manifestResponse.status})`)

    const bytes = Buffer.from(await manifestResponse.arrayBuffer())
    const actualHash = createHash(checksumAlgorithm).update(bytes).digest('hex')

    if (actualHash.toLowerCase() !== runtime.checksum.hash.toLowerCase()) {
      throw new Error(`Runtime manifest checksum mismatch for ${vendor} ${version}`)
    }

    manifest = JSON.parse(bytes.toString('utf8')) as JavaRuntimeManifest

    if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
      throw new Error(`Unsupported runtime manifest format for ${vendor} ${version}`)
    }
  } else if (runtime.downloadType === 'archive') {
    if (!runtime.url.startsWith('https://'))
      throw new Error('Java runtime archive URL must use HTTPS')
  } else {
    throw new Error(`Unsupported Java download type: ${runtime.downloadType}`)
  }

  return withJavaRuntimeLock(app, javaRuntimeLockKey(app, destination, getPath('jre')), () =>
    withStagedJavaRuntime(
      destination,
      async (staging) => {
        const workflow: InstallWorkflow<void> = manifest
          ? createJavaRuntimeManifestInstallWorkflow(manifest, staging)
          : createJavaArchiveInstallWorkflow({
              url: runtime.url,
              checksum: { algorithm: checksumAlgorithm, value: checksumHash },
              destination: staging,
            })
        const tracker = getTracker<JavaInstallTrackerEvents>(task)
        await runInstallWorkflow(
          workflow,
          async (plan) => {
            const progress = onDownloadMultiple(tracker, 'java-runtime.file', { path: destination })
            await installer.install(plan, { signal: task.controller.signal, tracker: progress })
          },
          { maxStages: 16 },
        )
        let executable = await findJavaExecutable(staging, app.platform)
        if (executable && runtime.downloadType === 'archive') {
          executable = await flattenJavaArchive(staging, executable)
        }
        const inspected = executable && (await inspectJava(executable, { timeout: 5000 }))
        if (!executable || !inspected) {
          throw new AnyError(
            'InstallJavaError',
            `Installed ${vendor} Java ${version}, but its executable could not be validated`,
          )
        }
        if (inspected.majorVersion !== majorVersion) {
          throw new AnyError(
            'InstallJavaError',
            `Expected Java ${majorVersion}, but the downloaded runtime is Java ${inspected.majorVersion}`,
          )
        }
        if (replacement) {
          const old = getManagedJavaComponent(replacement.javaPath, getPath('jre'))
          const same = (a: string, b: string) =>
            app.platform.os === 'windows'
              ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
              : resolve(a) === resolve(b)
          if (
            !old ||
            !same(join(getPath('jre'), old.component), replacement.runtimePath) ||
            same(destination, replacement.runtimePath)
          ) {
            throw new Error('Cannot safely identify the previous Java runtime')
          }
          const key = javaRuntimeLockKey(app, replacement.javaPath, getPath('jre'))
          replacementIdentity = await withJavaRuntimeLock(app, key, () =>
            getOrCreateJavaRuntimeIdentity(replacement.runtimePath),
          )
          // Publish the recovery journal with the staged runtime in the same rename.
          await writeJavaReplacementJournal(staging, {
            ...inspected,
            path: join(destination, relative(staging, executable)),
            version: getJavaRuntimeVersionFromName(component) ?? inspected.version,
            valid: true,
            isInternal: true,
            installVendor: vendor,
            replacesJava: replacement.javaPath,
            replacementRuntime: replacement.runtimePath,
            replacementIdentity,
          })
        }
      },
      async () => {
        const executable = await findJavaExecutable(destination, app.platform)
        const result = executable ? await resolveJava(executable) : undefined
        if (!result) {
          throw new AnyError(
            'InstallJavaError',
            `Installed ${vendor} Java ${version}, but its executable could not be validated`,
          )
        }
        if (result.majorVersion !== majorVersion) {
          throw new AnyError(
            'InstallJavaError',
            `Expected Java ${majorVersion}, but the activated runtime is Java ${result.majorVersion}`,
          )
        }
        return { ...result, replacementIdentity }
      },
    ),
  )
}
