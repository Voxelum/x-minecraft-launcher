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
        (j.isInternal !== undefined && existed.isInternal !== j.isInternal) ||
        (j.installVendor !== undefined && existed.installVendor !== j.installVendor) ||
        (j.replacesJava !== undefined && existed.replacesJava !== j.replacesJava) ||
        (j.replacementRuntime !== undefined && existed.replacementRuntime !== j.replacementRuntime) ||
        existed.prependCommand !== prependCommand ||
        vmOptionsChanged
      ) {
        next[idx] = {
          ...existed,
          majorVersion: j.majorVersion,
          version: j.version,
          valid: j.valid,
          arch: j.arch || existed.arch,
          isInternal: j.isInternal ?? existed.isInternal,
          installVendor: j.installVendor ?? existed.installVendor,
          replacesJava: j.replacesJava ?? existed.replacesJava,
          replacementRuntime: j.replacementRuntime ?? existed.replacementRuntime,
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

/** Format a metadata build suffix for display alongside Java's version. */
export function formatJavaRuntimeVersion(value: string) {
  return value.replace(/\+(\d+)$/, (_match, build: string) => (build === '0' ? '' : `.${build}`))
}

/** Check path containment using Windows case and separator rules when applicable. */
export function isJavaExecutableWithinRuntime(executablePath: string, runtimePath: string) {
  if (!runtimePath) return false
  const windowsPath = runtimePath.includes('\\') || /^[a-z]:/i.test(runtimePath)
  const normalize = (path: string) => {
    const normalized = windowsPath ? path.replace(/\\/g, '/').toLowerCase() : path
    return normalized.replace(/\/+$/, '')
  }
  const executable = normalize(executablePath)
  const runtime = normalize(runtimePath)
  return executable === runtime || executable.startsWith(`${runtime}/`)
}

/** Find the installed runtime component under the new runtime's shared Java root. */
export function getInstalledJavaRuntimePath(executablePath: string, newRuntimePath: string) {
  const root = newRuntimePath.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '')
  if (!root || !isJavaExecutableWithinRuntime(executablePath, root)) return undefined

  const relativePath = executablePath.slice(root.length).replace(/^[\\/]+/, '')
  const parts = relativePath.split(/[\\/]/)
  if (parts.length < 2 || parts.some((part) => !part || part === '.' || part === '..'))
    return undefined
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root}${separator}${parts[0]}`
}

/** Match valid installations, including internal runtimes with collision suffixes. */
export function isJavaRuntimeInstalled(javas: readonly JavaRecord[], runtimePath: string) {
  return javas.some((java) => {
    if (!java.valid) return false
    if (isJavaExecutableWithinRuntime(java.path, runtimePath)) return true
    if (!java.isInternal || !java.installVendor) return false
    const component = getInstalledJavaRuntimePath(java.path, runtimePath)
    if (!component) return false
    const base = component.replace(/-xmcl-[0-9a-f]{32}$/i, '')
    return base !== component && isJavaExecutableWithinRuntime(base, runtimePath)
  })
}
