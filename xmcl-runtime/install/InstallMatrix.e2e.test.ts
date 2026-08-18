import { MinecraftFolder, Version, type ResolvedLibrary } from '@xmcl/core'
import type { DownloadResult } from '@xmcl/file-transfer'
import {
  createJavaRuntimeInstallWorkflow,
  createModernForgeInstallWorkflow,
  createNodeInstallRuntime,
  createZuluRuntimeInstallWorkflow,
  DEFAULT_FORGE_MAVEN,
  DEFAULT_RUNTIME_ALL_URL,
  DEFAULT_VERSION_MANIFEST_URL,
  diagnoseFile,
  diagnoseLibraries,
  diagnoseProfile,
  detectLibc,
  executeInstallWorkflow,
  executeInstallManifest,
  resolveForgeInstallerFile,
  resolveLibraryInstallFiles,
  resolveMinecraftJarInstallFile,
  resolveMinecraftVersionJsonInstallFile,
  resolveNeoForgedInstallerFile,
  selectZuluJRE,
  type InstallFile,
  type InstallForgeOptions,
  type InstallRuntime,
  type JarOption,
  type JavaRuntimes,
  type JavaRuntimeTarget,
  type LibraryOptions,
  type MinecraftVersionList,
  type PostProcessor,
  type ZuluJRE,
} from '@xmcl/installer'
import { readdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawn } from 'child_process'
import { DefaultRangePolicy } from '@xmcl/file-transfer'
import { Agent, buildConnector, interceptors } from 'undici'
import { describe, expect, it } from 'vitest'
import { waitProcess } from '@xmcl/installer/utils'
import zuluIndex from '../java/zulu.json'
import { getJavaExeFilePath } from '../java/java'
import { BmclDownloadController } from '../network/BmclDownloadController'
import { NetworkAgent } from '../network/NetworkAgent'
import { createFileTransferInstallDownloader } from '../network/FileTransferInstallDownloader'

const BMCL = 'https://bmclapi2.bangbang93.com'
const MINECRAFT = '1.21.1'
const JAVA_COMPONENT = 'java-runtime-delta'
const FORGE_VERSION = '52.1.0'
const FORGE_ARTIFACT_VERSION = `${MINECRAFT}-${FORGE_VERSION}`
const NEOFORGE_VERSION = '21.1.248'

type Loader = 'forge' | 'neoforge'
type DownloadSource = 'bmcl' | 'official'
type JavaSource = 'official' | 'zulu'

interface MatrixCase {
  loader: Loader
  download: DownloadSource
  java: JavaSource
}

const pairwiseMatrix: MatrixCase[] = [
  { loader: 'forge', download: 'bmcl', java: 'official' },
  { loader: 'forge', download: 'official', java: 'zulu' },
  { loader: 'neoforge', download: 'bmcl', java: 'zulu' },
  { loader: 'neoforge', download: 'official', java: 'official' },
]

const fullMatrix: MatrixCase[] = (['forge', 'neoforge'] as const).flatMap((loader) =>
  (['bmcl', 'official'] as const).flatMap((download) =>
    (['official', 'zulu'] as const).map((java) => ({ loader, download, java })),
  ),
)

function replaceHost(url: string, base: string) {
  const result = new URL(url)
  const replacement = new URL(base)
  result.protocol = replacement.protocol
  result.host = replacement.host
  return result.toString()
}

function sourceUrls(url: string, source: DownloadSource) {
  return source === 'bmcl' ? [replaceHost(url, BMCL), url] : [url]
}

async function fetchJson<T>(urls: string | string[]): Promise<T> {
  const errors: unknown[] = []
  for (const url of typeof urls === 'string' ? [urls] : urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Cannot fetch ${url}: ${response.status}`)
        return response.json() as Promise<T>
      } catch (error) {
        errors.push(error)
      }
    }
  }
  throw new AggregateError(errors, `Cannot fetch JSON from ${typeof urls === 'string' ? urls : urls.join(', ')}`)
}

function resolveOfficialJavaTarget(runtimes: JavaRuntimes): JavaRuntimeTarget {
  const platform = process.platform === 'win32'
    ? process.arch === 'arm64'
      ? 'windows-arm64'
      : process.arch === 'ia32'
        ? 'windows-x86'
        : 'windows-x64'
    : process.platform === 'darwin'
      ? process.arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
      : process.arch === 'ia32' ? 'linux-i386' : 'linux'
  const target = runtimes[platform][JAVA_COMPONENT]?.[0]
  if (!target) throw new Error(`No official ${JAVA_COMPONENT} runtime for ${platform}`)
  return target
}

function resolveZuluRuntime(): ZuluJRE {
  const entries = (zuluIndex as Record<string, unknown>)[JAVA_COMPONENT] as ZuluJRE[] | undefined
  const runtime = entries && selectZuluJRE(entries, process.platform, process.arch, detectLibc())
  if (!runtime) throw new Error(`No Zulu ${JAVA_COMPONENT} runtime for ${process.platform} ${process.arch}`)
  return runtime
}

function getRuntimePlatform() {
  return {
    os: process.platform === 'win32' ? 'windows' as const : process.platform === 'darwin' ? 'osx' as const : 'linux' as const,
    osRelease: '',
    arch: process.arch,
  }
}

function createInstallOptions(
  source: DownloadSource,
  java: string,
): InstallForgeOptions & JarOption & LibraryOptions & { fetch: typeof fetch } {
  const libraryHost = (library: ResolvedLibrary) => {
    const urls = source === 'bmcl'
      ? [`${BMCL}/maven/${library.download.path}`, library.download.url]
      : [library.download.url]
    if (!['mojang', 'minecraft', 'forge', 'fabric', 'optifine'].some((keyword) => library.name.includes(keyword))) {
      urls.push(`${DEFAULT_FORGE_MAVEN}/${library.download.path}`)
    }
    return urls
  }
  return {
    fetch,
    side: 'client',
    java,
    inheritsFrom: MINECRAFT,
    json: (version) => sourceUrls(version.url, source),
    client: (version) => version.downloads.client
      ? sourceUrls(version.downloads.client.url, source)
      : [],
    mavenHost: source === 'bmcl' ? [`${BMCL}/maven`, DEFAULT_FORGE_MAVEN] : [DEFAULT_FORGE_MAVEN],
    libraryHost,
  }
}

async function createMatrixDispatcher() {
  const tls: buildConnector.BuildOptions = {
    timeout: 25_000,
    rejectUnauthorized: false,
    requestCert: false,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 850,
  }
  const dispatcher = new NetworkAgent({
    userAgent: 'voxelum/x_minecraft_launcher/install-matrix',
    requestTls: tls,
    proxyTls: tls,
    factory: (connect) => new Agent({
      connections: 32,
      headersTimeout: 25_000,
      bodyTimeout: 10_000,
      connect,
    }).compose(
      interceptors.retry({
        errorCodes: [
          'UND_ERR_CONNECT_TIMEOUT',
          'UND_ERR_HEADERS_TIMEOUT',
          'UND_ERR_BODY_TIMEOUT',
          'ECONNRESET',
          'ECONNREFUSED',
          'ENOTFOUND',
          'ENETDOWN',
          'ETIMEDOUT',
          'ENETUNREACH',
          'EHOSTDOWN',
          'EHOSTUNREACH',
          'EPIPE',
          'UND_ERR_SOCKET',
        ],
        statusCodes: [567, 500, 502, 503, 504, 429],
        maxRetries: 3,
      }),
      interceptors.redirect({ maxRedirections: 5 }),
    ) as Agent,
  }, () => {})
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  if (proxy) {
    await dispatcher.setProxy(new URL(proxy))
    dispatcher.setProxyEnabled(true)
  }
  return dispatcher
}

function observeRuntime(
  runtime: InstallRuntime,
  plannedUrls: string[],
): InstallRuntime {
  return {
    ...runtime,
    download: (files) => {
      plannedUrls.push(...files.flatMap((file) => file.urls))
      return runtime.download(files)
    },
  }
}

async function verifyJava(executable: string) {
  const child = spawn(executable, ['-version'], { stdio: 'ignore' })
  await waitProcess(child)
}

async function resolveMojmapProcessor(
  processor: PostProcessor,
  folder: MinecraftFolder,
  source: DownloadSource,
) {
  const values = new Map<string, string>()
  for (let index = 0; index < processor.args.length - 1; index++) {
    const argument = processor.args[index]
    if (argument.startsWith('--')) values.set(argument, processor.args[index + 1])
  }
  if (values.get('--task') !== 'DOWNLOAD_MOJMAPS' || processor.args.includes('--sanitize')) {
    return { handled: false }
  }
  const version = values.get('--version')
  const side = values.get('--side')
  const output = values.get('--output')
  if (!version || !side || !output) return { handled: false }
  const parsed = await Version.parse(folder, version)
  const mapping = parsed.downloads[`${side}_mappings`]
  if (!mapping) return { handled: false }
  const file: InstallFile = {
    path: output.replace('.tsrg', '.original.tsrg'),
    urls: sourceUrls(mapping.url, source),
    size: mapping.size,
    checksum: mapping.sha1 ? { algorithm: 'sha1', value: mapping.sha1 } : undefined,
  }
  return { handled: true, files: [file] }
}

const run = process.env.INSTALL_MATRIX || process.env.INSTALL_MATRIX_FULL ? describe : describe.skip
const matrix = process.env.INSTALL_MATRIX_FULL ? fullMatrix : pairwiseMatrix

run('from-zero Forge and NeoForge install matrix', () => {
  it.each(matrix)(
    '$loader via $download with $java Java',
    async ({ loader, download, java }) => {
      const root = await mkdtemp(join(tmpdir(), `xmcl-${loader}-${download}-${java}-`))
      let stage = 'setup'
      const startedAt = Date.now()
      const heartbeat = setInterval(() => {
        console.info(`[install-matrix] ${loader}/${download}/${java} stage=${stage} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`)
      }, 15_000)
      const dispatcher = await createMatrixDispatcher()
      const reports: DownloadResult[] = []
      const controller = download === 'bmcl'
        ? new BmclDownloadController({ warmup: 1_500, ttfbDeadline: 6_000, maxResumes: 12 })
        : undefined
      if (controller) {
        controller.setReassignableHosts([new URL(BMCL).hostname])
        const report = controller.report.bind(controller)
        controller.report = (result) => {
          reports.push(result)
          report(result)
        }
      }
      const plannedUrls: string[] = []
      const downloader = createFileTransferInstallDownloader({
        dispatcher,
        rangePolicy: new DefaultRangePolicy(5 * 1024 * 1024, 4),
      }, controller)
      const runtime = observeRuntime(createNodeInstallRuntime({
        download: (files) => downloader.download(files),
      }), plannedUrls)
      const folder = MinecraftFolder.from(root)

      try {
        expect(await readdir(root)).toEqual([])
        const javaRoot = join(root, 'jre', `${JAVA_COMPONENT}${java === 'zulu' ? '-zulu' : ''}`)
        const javaExecutable = getJavaExeFilePath(javaRoot, getRuntimePlatform())
        stage = `java-${java}`
        if (java === 'official') {
          const runtimes = await fetchJson<JavaRuntimes>(sourceUrls(DEFAULT_RUNTIME_ALL_URL, download))
          await executeInstallWorkflow(createJavaRuntimeInstallWorkflow({
            target: resolveOfficialJavaTarget(runtimes),
            destination: javaRoot,
            apiHost: download === 'bmcl' ? new URL(BMCL).hostname : undefined,
          }), runtime)
        } else {
          await executeInstallWorkflow(createZuluRuntimeInstallWorkflow({
            runtime: resolveZuluRuntime(),
            destination: javaRoot,
            executable: javaExecutable,
          }), runtime)
        }
        await verifyJava(javaExecutable)

        stage = 'minecraft-metadata'
        const manifest = await fetchJson<MinecraftVersionList>(
          sourceUrls(DEFAULT_VERSION_MANIFEST_URL, download),
        )
        const minecraft = manifest.versions.find((version) => version.id === MINECRAFT)
        if (!minecraft) throw new Error(`Cannot find Minecraft ${MINECRAFT}`)
        const options = createInstallOptions(download, javaExecutable)
        stage = 'minecraft-version-json'
        await executeInstallManifest({
          schemaVersion: 1,
          tasks: [{
            id: 'minecraft-version-json',
            type: 'files',
            files: [resolveMinecraftVersionJsonInstallFile(minecraft, folder, options)],
          }],
        }, runtime)
        const base = await Version.parse(folder, MINECRAFT)
        const baseFiles = resolveLibraryInstallFiles(base.libraries, folder, options)
        const jar = resolveMinecraftJarInstallFile(base, options)
        if (jar) baseFiles.push(jar)
        stage = 'minecraft-base-files'
        await executeInstallManifest({
          schemaVersion: 1,
          tasks: [{ id: 'minecraft-base-files', type: 'files', files: baseFiles }],
        }, runtime)

        stage = `${loader}-installer`
        const installer = loader === 'forge'
          ? resolveForgeInstallerFile(FORGE_ARTIFACT_VERSION, {
              path: `net/minecraftforge/forge/${FORGE_ARTIFACT_VERSION}/forge-${FORGE_ARTIFACT_VERSION}-installer.jar`,
              sha1: 'fa4f90047c23e6df4d2b4e649aec7fd5d1e20acd',
            }, folder, options).file
          : (await resolveNeoForgedInstallerFile('neoforge', NEOFORGE_VERSION, folder, options)).file
        stage = `${loader}-compile`
        const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({
          id: `${loader}:${loader === 'forge' ? FORGE_VERSION : NEOFORGE_VERSION}`,
          minecraft: folder,
          minecraftVersion: MINECRAFT,
          installer,
          artifactVersion: loader === 'forge' ? FORGE_ARTIFACT_VERSION : NEOFORGE_VERSION,
          java: javaExecutable,
          installOptions: options,
          resolveProcessor: (processor) => resolveMojmapProcessor(processor, folder, download),
        }), runtime)

        stage = 'diagnose'
        const installed = await Version.parse(folder, result.version)
        expect(await diagnoseProfile(result.profile, folder, 'client')).toBe(false)
        expect(await diagnoseLibraries(installed.libraries, folder, { strict: true })).toEqual([])
        expect(await diagnoseFile({
          file: folder.getVersionJar(MINECRAFT, 'client'),
          expectedChecksum: base.downloads.client?.sha1 ?? '',
          role: 'minecraftClientJar',
          hint: 'Reinstall the client version.',
        }, { strict: true })).toBeUndefined()
        const bmclPlanned = plannedUrls.some((url) => new URL(url).hostname === new URL(BMCL).hostname)
        expect(bmclPlanned).toBe(download === 'bmcl')
        if (download === 'bmcl') {
          expect(reports.some((report) => new URL(report.origin).hostname === new URL(BMCL).hostname)).toBe(true)
        }
      } finally {
        clearInterval(heartbeat)
        await dispatcher.close()
        if (!process.env.INSTALL_MATRIX_KEEP) {
          await rm(root, { recursive: true, force: true })
        }
      }
    },
    15 * 60_000,
  )
})