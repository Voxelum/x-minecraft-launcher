import type { JavaVersion } from '@xmcl/core'
import {
  createJavaInstallWorkflow,
  detectLibc,
  runInstallWorkflow,
  onDownloadMultiple,
  resolveJavaInstallManifest,
  resolveJavaWithDiagnostic,
  type InstallWorkflow,
  type JavaInstallCandidate,
  type JavaInstallManifest,
  type JavaRuntimeTrackerEvents,
  type ProgressTrackerMultiple,
  type ResolvedJavaInstallCandidate,
  type Tracker,
  type ZuluTrackerEvents,
} from '@xmcl/installer'
import type { InstallJavaTask, Java } from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { readFile, stat } from 'fs-extra'
import { dirname, join } from 'path'
import type { LauncherApp, PathResolver } from '~/app'
import { kFlights, kGFW, type TaskInstance } from '~/infra'
import type { InstallManifestService } from '~/install/InstallManifestService'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { getTracker } from '~/util/taskHelper'
import { readdirIfPresent } from '~/util/fs'
import {
  JavaValidation,
  classifyJavaInstallFailure,
  detectExecutableLibc,
  getJavaExeFilePath,
  sanitizeJavaResolveOutput,
  validateJavaPath,
} from './java'
import { getOfficialJavaManifest } from './installDefaultJava'
import { getZuluJRE } from './zulu'

type JavaInstallTrackerEvents = JavaRuntimeTrackerEvents & ZuluTrackerEvents
type JavaInstallSource = 'zulu' | 'official' | 'official-then-zulu'

export async function resolveLauncherJavaInstallManifest(
  app: LauncherApp,
  getPath: PathResolver,
  target: JavaVersion,
  forceZulu = false,
): Promise<JavaInstallManifest> {
  const flights = await app.registry.get(kFlights)
  forceZulu ||= flights.forceZuluJre

  const settings = await app.registry.get(kSettings)
  const gfw = await app.registry.get(kGFW)
  const apis = getApiSets(settings)
  const apiHost = shouldOverrideApiSet(settings, gfw.inside)
    ? apis.map((api) => new URL(api.url).hostname)
    : undefined
  const officialDestination = getPath('jre', target.component)
  const zuluDestination = getPath('jre', `${target.component}-zulu`)

  return resolveJavaInstallManifest({
    target,
    forceZulu,
    officialDestination,
    officialExecutable: getJavaExeFilePath(officialDestination, app.platform),
    zuluDestination,
    zuluExecutable: getJavaExeFilePath(zuluDestination, app.platform),
    apiHost,
  }, {
    getOfficialRuntime: () => getOfficialJavaManifest(app, target.component).catch(() => undefined),
  })
}

async function runJavaInstallWorkflow(
  installer: InstallManifestService,
  workflow: InstallWorkflow<void>,
  task: TaskInstance<InstallJavaTask>,
  target: JavaVersion,
  candidate: ResolvedJavaInstallCandidate,
) {
  const tracker = getTracker<JavaInstallTrackerEvents>(task)
  return runInstallWorkflow(workflow, async (plan) => {
    let progress: ProgressTrackerMultiple | undefined
    if (candidate.source === 'zulu') {
      progress = onDownloadMultiple(tracker, 'zulu-java.download', {})
    } else if (plan.tasks.some((value) => value.id === 'java-runtime-manifest')) {
      progress = onDownloadMultiple(tracker, 'java-runtime.json', { target: target.component })
    } else {
      progress = onDownloadMultiple(tracker, 'java-runtime.file', { path: candidate.destination })
    }
    await installer.install(plan, {
      signal: task.controller.signal,
      tracker: progress,
    })
  }, { maxStages: 16 })
}

export async function applyJavaInstallManifest(
  app: LauncherApp,
  installer: InstallManifestService,
  task: TaskInstance<InstallJavaTask>,
  manifest: JavaInstallManifest,
  resolveJava: (path: string) => Promise<Java | undefined>,
): Promise<Java> {
  const logger = app.getLogger('JavaInstall')
  let lastError: unknown
  const attempted: JavaInstallCandidate['source'][] = []
  for (const candidate of manifest.candidates) {
    attempted.push(candidate.source)
    const installSource: JavaInstallSource = attempted[0] === 'official' && attempted.length > 1
      ? 'official-then-zulu'
      : candidate.source
    logger.log(
      `Install ${candidate.source} java runtime ${manifest.target.component} ` +
      `(${manifest.target.majorVersion}) into ${candidate.destination}`,
    )
    try {
      const resolvedCandidate: ResolvedJavaInstallCandidate = candidate.source === 'zulu'
        ? { ...candidate, runtime: await getZuluJRE(app, manifest.target.component as any) }
        : candidate
      await runJavaInstallWorkflow(
        installer,
        createJavaInstallWorkflow(resolvedCandidate),
        task,
        manifest.target,
        resolvedCandidate,
      )
      const validation = await validateJavaPath(candidate.executable)
      const result = validation === JavaValidation.Okay
        ? await resolveJava(candidate.executable)
        : undefined
      if (result) return result
      lastError = await createInstallDefaultJavaError(
        app,
        candidate.executable,
        candidate.destination,
        manifest.target,
        installSource,
      )
    } catch (error) {
      lastError = error
    }
    logger.warn(
      `Failed to install ${candidate.source} java runtime ${manifest.target.component}: ${lastError}`,
    )
  }
  throw lastError ?? new Error(`No Java install candidate for ${manifest.target.component}`)
}

async function createInstallDefaultJavaError(
  app: LauncherApp,
  exeLocation: string,
  folder: string,
  target: JavaVersion,
  installSource: JavaInstallSource,
) {
  const safe = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn()
    } catch {
      return undefined
    }
  }

  const exeStat = await safe(() => stat(exeLocation))
  const exeExists = !!exeStat
  const exeSize = exeStat?.size
  const validation = await safe(() => validateJavaPath(exeLocation))
  const binDir = dirname(exeLocation)
  const binFiles = await safe(() => readdirIfPresent(binDir))
  const folderFiles = await safe(() => readdirIfPresent(folder))
  const home = dirname(binDir)
  const releaseRaw = await safe(() => readFile(join(home, 'release'), 'utf-8'))
  const releaseJavaVersion = releaseRaw
    ?.split('\n')
    .map((line) => line.split('='))
    .find((value) => value[0] === 'JAVA_VERSION')?.[1]
    ?.replace(/"/g, '')

  let resolveExitCode: number | undefined
  let resolveSignal: string | undefined
  let resolveStdout: string | undefined
  let resolveStderr: string | undefined
  if (exeExists) {
    try {
      const diagnostic = await resolveJavaWithDiagnostic(exeLocation)
      resolveExitCode = diagnostic.exitCode
      resolveSignal = diagnostic.signal
      resolveStdout = sanitizeJavaResolveOutput(diagnostic.stdout)
      resolveStderr = sanitizeJavaResolveOutput(diagnostic.stderr)
    } catch (error) {
      resolveStderr = sanitizeJavaResolveOutput(
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      )
    }
  }

  const phase = classifyJavaInstallFailure({ exeExists, validation })
  let exeLibc: 'musl' | 'glibc' | undefined
  let hostLibc: 'musl' | 'glibc' | undefined
  if (app.platform.os === 'linux' && exeExists) {
    exeLibc = await safe(() => detectExecutableLibc(exeLocation))
    hostLibc = detectLibc()
  }

  return new AnyError(
    'InstallDefaultJavaError',
    `Fail to install java: ${phase} (source=${installSource}, component=${target.component}, exeExists=${exeExists})`,
    undefined,
    {
      phase,
      installSource,
      component: target.component,
      majorVersion: target.majorVersion,
      exeLocation,
      exeExists,
      exeSize,
      validation: validation !== undefined ? JavaValidation[validation] : 'unknown',
      binFileCount: binFiles?.length,
      folderFileCount: folderFiles?.length,
      folderEmpty: folderFiles ? folderFiles.length === 0 : undefined,
      releaseFilePresent: releaseRaw !== undefined,
      releaseJavaVersion,
      resolveExitCode,
      resolveSignal,
      resolveStdout,
      resolveStderr,
      exeLibc,
      hostLibc,
      libcMismatch: exeLibc && hostLibc ? exeLibc !== hostLibc : undefined,
      platform: `${app.platform.os} ${app.platform.arch}`,
    },
  )
}
