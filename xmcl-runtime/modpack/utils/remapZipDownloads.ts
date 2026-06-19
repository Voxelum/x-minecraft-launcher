import type { InstanceFile } from '@xmcl/instance'

/**
 * Re-point the absolute `zip:///<path>?entry=...` download URL of a cached
 * modpack file at the current modpack location.
 *
 * The override files produced when opening a modpack embed the absolute path of
 * the modpack zip. Those files are cached keyed by file hash, so reusing them
 * for a file opened from a different path (e.g. the user moved the modpack into
 * a subfolder) would otherwise unzip from a stale, non-existent location and
 * fail with ENOENT ("modpack file not found").
 *
 * The hash-relative `zip://<hash>/...` URL and any http downloads are left
 * untouched.
 *
 * @param file The cached instance file.
 * @param modpackFile The absolute path of the modpack the file belongs to.
 */
export function remapModpackZipDownloads(file: InstanceFile, modpackFile: string): InstanceFile {
  if (!file.downloads) return file
  let changed = false
  const downloads = file.downloads.map((d) => {
    if (!d.startsWith('zip:///')) return d
    let url: URL
    try {
      url = new URL(d)
    } catch {
      return d
    }
    // A host means it's the hash-relative `zip://<hash>/...` form, not an
    // absolute path. Leave it untouched.
    if (url.host) return d
    const entry = url.searchParams.get('entry')
    if (!entry) return d
    changed = true
    return `zip:///${modpackFile}?entry=${encodeURIComponent(entry)}`
  })
  return changed ? { ...file, downloads } : file
}
