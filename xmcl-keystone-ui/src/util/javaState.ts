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
export function mergeJavaUpdate(current: JavaRecord[], update: JavaRecord | JavaRecord[]): JavaRecord[] {
  const incoming = Array.isArray(update) ? update : [update]
  const next = current.slice()
  let changed = false
  for (const j of incoming) {
    const idx = next.findIndex(jp => jp.path === j.path)
    if (idx >= 0) {
      const existed = next[idx]
      // Only clone when something actually changed; idempotent refreshes
      // must keep the reference so consumers that .map() over `all` don't
      // re-run for no reason.
      if (existed.majorVersion !== j.majorVersion
        || existed.version !== j.version
        || existed.valid !== j.valid
        || (j.arch && existed.arch !== j.arch)) {
        next[idx] = {
          ...existed,
          majorVersion: j.majorVersion,
          version: j.version,
          valid: j.valid,
          arch: j.arch || existed.arch,
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
