import { ResourceDomain } from '../ResourceDomain'

export function shouldIgnoreFile(file: string, domain?: ResourceDomain) {
  if (
    file.endsWith('.pending') ||
    file.endsWith('.DS_Store') ||
    file.endsWith('.backup') ||
    // file.endsWith('.txt') ||
    file.endsWith('.gitkeep') ||
    file.endsWith('.gitignore') ||
    file.endsWith('.rartemp')
  ) {
    return true
  }

  // For resource packs and shader packs, only `.zip` archives and
  // directories (folders without an extension, e.g. an unzipped pack)
  // are valid. Config / cache files that mods or shaders leave in these
  // folders — `.toml`, `.rpo`, `.properties`, `.json`, `.cfg`, ... —
  // are not zip files and previously caused the resource parser to
  // throw `InvalidZipFileError`, which surfaced as a noisy
  // "Cannot read <file>" toast (see #1448).
  //
  // We only know the file name here (no stat), so we keep entries
  // without an extension because they may be unzipped pack folders.
  if (
    domain === ResourceDomain.ResourcePacks ||
    domain === ResourceDomain.ShaderPacks
  ) {
    const lastDot = file.lastIndexOf('.')
    const lastSep = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'))
    if (lastDot > lastSep && lastDot < file.length - 1) {
      const ext = file.slice(lastDot).toLowerCase()
      if (ext !== '.zip') {
        return true
      }
    }
  }

  return false
}
