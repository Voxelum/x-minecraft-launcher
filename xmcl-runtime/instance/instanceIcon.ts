import { isAbsolute, join, relative } from 'path'

/**
 * The prefix of a local media URL that serves an absolute file path through
 * the `http://launcher/media` protocol handler.
 */
export const MEDIA_URL_PREFIX = 'http://launcher/media?path='

/**
 * Whether the icon value carries an explicit URL scheme (e.g. `http:`,
 * `https:`, `data:`). Such values reference external or global resources and
 * must be preserved verbatim. A bare relative path (e.g. `icon.png`) has no
 * scheme and is resolved against the instance folder instead.
 */
function hasScheme(icon: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(icon)
}

/**
 * Extract the absolute file path encoded in a local media URL, or `undefined`
 * if the icon is not such a URL.
 */
export function getMediaIconPath(icon: string): string | undefined {
  if (!icon.startsWith(MEDIA_URL_PREFIX)) return undefined
  const raw = icon.substring(MEDIA_URL_PREFIX.length)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * Build the in-memory media URL that the renderer uses to display an icon file
 * located at `iconPath`.
 */
export function toMediaIconUrl(iconPath: string): string {
  return MEDIA_URL_PREFIX + iconPath
}

/**
 * Resolve a persisted icon reference into a renderable URL.
 *
 * Icons stored inside the instance folder are persisted in `instance.json` as
 * a path relative to the instance folder so they stay valid when the instance
 * is moved or shared across machines / operating systems. This converts such a
 * relative reference back into an absolute `http://launcher/media` URL using
 * the instance's current absolute path. External URLs (http/https/data) and
 * global image URLs are returned unchanged.
 */
export function resolveInstanceIcon(icon: string | undefined, instancePath: string): string {
  if (!icon) return ''
  if (hasScheme(icon)) return icon
  const abs = isAbsolute(icon) ? icon : join(instancePath, icon)
  return toMediaIconUrl(abs)
}

/**
 * Convert an in-memory icon URL into a portable form for `instance.json`.
 *
 * When the icon is a local media URL that points at a file inside the instance
 * folder, it is rewritten to a path relative to the instance folder so the
 * reference survives moving the instance or opening it on another OS. All other
 * values (external URLs, global image URLs, already-relative paths) are kept
 * as-is.
 */
export function serializeInstanceIcon(icon: string | undefined, instancePath: string): string {
  if (!icon) return ''
  const mediaPath = getMediaIconPath(icon)
  if (!mediaPath) return icon
  const rel = relative(instancePath, mediaPath)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    // The file lives outside the instance folder, keep the absolute URL.
    return icon
  }
  return rel.split('\\').join('/')
}
