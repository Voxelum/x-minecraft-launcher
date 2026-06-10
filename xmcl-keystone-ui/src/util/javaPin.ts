import type { JavaRecord } from '@xmcl/runtime-api'

/**
 * Decide what to write into `instance.java` when the user clicks an entry
 * in the Java picker.
 *
 * The two cases that must NOT pin a concrete path:
 *  1. The "Auto" sentinel (empty path).
 *  2. The user is in auto mode and re-selects the JDK the auto resolver is
 *     already using. Pinning here is a footgun: if that JDK is later
 *     uninstalled the user thinks they're still on auto and is surprised
 *     when nothing falls back.
 *
 * Returns `undefined` to mean "clear the pin / stay on auto", or a string
 * path to write.
 */
export function resolvePinChoice(
  value: JavaRecord | undefined,
  isAuto: boolean,
  autoResolvedPath: string | undefined,
): string | undefined {
  if (!value || value.path === '') return undefined
  if (isAuto && autoResolvedPath && value.path === autoResolvedPath) return undefined
  return value.path
}

/**
 * Decide whether removing `removed` from the Java catalogue should also
 * clear the instance's pinned Java path.
 *
 * True only when the pin currently points at the JDK being deleted; the
 * caller should then null out `instance.java` so the instance reverts to
 * auto-detection instead of holding a dangling reference.
 */
export function shouldClearPinOnRemove(
  removedPath: string | undefined,
  currentPin: string | undefined,
): boolean {
  if (!removedPath || !currentPin) return false
  return removedPath === currentPin
}
