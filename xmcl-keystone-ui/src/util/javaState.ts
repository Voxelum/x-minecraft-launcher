import type { JavaRecord } from '@xmcl/runtime-api'

/**
 * Apply a `javaUpdate` mutation against an existing `all` snapshot and
 * return either the same array reference (when nothing observable changed)
 * or a brand-new array reflecting the merge.
 *
 * The base `JavaState.javaUpdate` from `xmcl-runtime-api` mutates in place,
 * which breaks Vue reactivity for downstream `watch([all, ...])` consumers
 * — the reference comparison passes even though the contents diverged.
 * Use this helper from the renderer-side `JavaState` override to produce a
 * fresh array only when needed, so reactive watchers fire exactly when an
 * observable change happened.
 */
export function mergeJavaUpdate(
  current: JavaRecord[],
  update: JavaRecord | JavaRecord[],
): JavaRecord[] {
  const incoming = Array.isArray(update) ? update : [update]
  const next = current.slice()
  let changed = false
  for (const j of incoming) {
    const idx = next.findIndex((jp) => jp.path === j.path)
    if (idx >= 0) {
      const existed = next[idx]

      // Only clone when something actually changed; idempotent refreshes
      // must keep the reference so consumers that .map() over `all` don't
      // re-run for no reason.

      const prependCommand = j.prependCommand ?? existed.prependCommand
      const vmOptions = j.vmOptions ?? existed.vmOptions

      const vmOptionsChanged =
        existed.vmOptions?.length !== vmOptions?.length ||
        existed.vmOptions?.some((v, i) => v !== vmOptions?.[i]) ||
        false

      if (
        existed.majorVersion !== j.majorVersion ||
        existed.version !== j.version ||
        existed.valid !== j.valid ||
        (j.arch && existed.arch !== j.arch) ||
        existed.prependCommand !== prependCommand ||
        vmOptionsChanged
      ) {
        next[idx] = {
          ...existed,
          majorVersion: j.majorVersion,
          version: j.version,
          valid: j.valid,
          arch: j.arch || existed.arch,
          prependCommand,
          vmOptions,
        }
        changed = true
      }
    } else {
      next.push(j)
      changed = true
    }
  }
  return changed ? next : current
}

export function sortJavaRecords(javas: readonly JavaRecord[]) {
  return [...javas].sort(
    (a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true }) ||
      b.path.localeCompare(a.path),
  )
}

export function isJavaExecutableWithinRuntime(executablePath: string, runtimePath: string) {
  if (!runtimePath) return false
  const runtime = runtimePath.replace(/[\\/]+$/, '')
  const executable = runtimePath.includes('\\') ? executablePath.toLowerCase() : executablePath
  const normalizedRuntime = runtimePath.includes('\\') ? runtime.toLowerCase() : runtime
  return (
    executable === normalizedRuntime ||
    executable.startsWith(`${normalizedRuntime}/`) ||
    executable.startsWith(`${normalizedRuntime}\\`)
  )
}

export function isJavaRuntimeInstalled(javas: readonly JavaRecord[], runtimePath: string) {
  return javas.some((java) => java.valid && isJavaExecutableWithinRuntime(java.path, runtimePath))
}
