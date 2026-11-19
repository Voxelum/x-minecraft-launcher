import type { JavaRecord, VersionInstallService } from '@xmcl/runtime-api'
import { formatJavaRuntimeVersion, getInstalledJavaRuntimePath } from '@/util/javaState'

export type JavaRuntimeUpdate = {
  vendor: string
  version: string
  majorVersion: number
  runtimeUrl: string
  runtimePath: string
  displayVersion: string
}

/** Compare Java version strings after normalizing their build notation. */
function compareJavaVersions(left: string, right: string) {
  return normalizeJavaVersion(left).localeCompare(normalizeJavaVersion(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

/** Normalize legacy and metadata build notation for numeric comparison. */
function normalizeJavaVersion(version: string) {
  return version
    .replace(/^1\.(?=\d)/, '')
    .replace(/_(\d+)$/, '.$1')
    .replace(/\+(\d+)$/, (_match, build: string) => (build === '0' ? '' : `.${build}`))
}

/** Check whether a candidate is newer, accounting for legacy Java 8 output. */
function isNewerJavaVersion(candidate: string, current: string) {
  // Java 8's legacy version string does not include the metadata build number.
  const comparableCandidate = /^1\.8(?:\.|_|$)/.test(current)
    ? candidate.replace(/\+\d+$/, '')
    : candidate
  return compareJavaVersions(comparableCandidate, current) > 0
}

/** Derive the package family used to match different versions of a runtime. */
function getRuntimeFamily(name: string) {
  // Ignore both the installed version and XMCL's collision-avoidance suffix.
  return name.replace(/-xmcl-[0-9a-f]{32}$/i, '').replace(/\d.*$/, '')
}

/** Match metadata to the installed runtime's component family. */
function matchesRuntimeFamily(java: JavaRecord, runtime: JavaRuntime) {
  const component = getInstalledJavaRuntimePath(java.path, runtime.path)?.split(/[\\/]/).pop()
  return component !== undefined && getRuntimeFamily(component) === getRuntimeFamily(runtime.name)
}

type JavaRuntime = Awaited<ReturnType<VersionInstallService['getJavaRuntimes']>>[number]

const JAVA_UPDATE_CHECK_TIMEOUT = 10_000

/** Find the newest matching internal runtime; throw on timeout or if all lookups fail. */
export async function findJavaRuntimeUpdate(
  java: JavaRecord,
  vendors: string[],
  getJavaRuntimes: VersionInstallService['getJavaRuntimes'],
): Promise<JavaRuntimeUpdate | undefined> {
  if (!java.isInternal) return undefined

  const candidates = java.installVendor ? [java.installVendor] : vendors
  let timeout: ReturnType<typeof setTimeout> | undefined
  // A stalled metadata request must not indefinitely block a game launch.
  const results = await Promise.race([
    Promise.allSettled(
      candidates.map(async (vendor) => ({
        vendor,
        runtimes: await getJavaRuntimes(vendor, `java${java.majorVersion}`, undefined, true),
      })),
    ),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Java update check timed out')), JAVA_UPDATE_CHECK_TIMEOUT)
    }),
  ]).finally(() => clearTimeout(timeout))
  const available = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  )

  if (available.length === 0 && results.some((result) => result.status === 'rejected')) {
    throw new AggregateError(
      results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : [])),
      'Unable to check for Java runtime updates',
    )
  }

  let latest: JavaRuntimeUpdate | undefined
  for (const { vendor, runtimes } of available) {
    for (const runtime of runtimes) {
      if (!matchesRuntimeFamily(java, runtime)) continue
      if (!isNewerJavaVersion(runtime.displayVersion, java.version)) continue
      if (latest && compareJavaVersions(runtime.displayVersion, latest.displayVersion) <= 0)
        continue

      latest = {
        vendor,
        version: runtime.version,
        majorVersion: java.majorVersion,
        runtimeUrl: runtime.runtimeUrl,
        runtimePath: runtime.path,
        displayVersion: formatJavaRuntimeVersion(runtime.displayVersion),
      }
    }
  }

  return latest
}

export interface JavaUpdatePromptPayload {
  id: number
  currentVersion: string
  nextVersion: string
}

type PromptWaiter = {
  resolve(update: boolean): void
  signal: AbortSignal
  onAbort(): void
}

let nextPromptId = 0
const promptWaiters = new Map<number, PromptWaiter>()

/** Deliver a dialog decision to the launch waiting for this prompt. */
export function resolveJavaUpdatePrompt(id: number, update: boolean) {
  const waiter = promptWaiters.get(id)
  if (!waiter) return
  promptWaiters.delete(id)
  waiter.signal.removeEventListener('abort', waiter.onAbort)
  waiter.resolve(update)
}

/** Show an update prompt and resolve false if its launch is cancelled. */
export function promptJavaUpdate(
  show: (payload: JavaUpdatePromptPayload) => void,
  hide: () => void,
  currentVersion: string,
  nextVersion: string,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }

    const id = ++nextPromptId
    const onAbort = () => {
      resolveJavaUpdatePrompt(id, false)
      hide()
    }
    promptWaiters.set(id, { resolve, signal, onAbort })
    signal.addEventListener('abort', onAbort, { once: true })

    if (signal.aborted) {
      onAbort()
      return
    }
    show({ id, currentVersion, nextVersion })
  })
}
