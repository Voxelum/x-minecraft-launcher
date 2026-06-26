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

  // Each domain only accepts a small set of archive extensions. Config /
  // cache / text files that mods, resource packs or shaders leave in
  // these folders — `.ini`, `.txt`, `.toml`, `.properties`, `.json`,
  // `.cfg`, ... — are not valid archives and previously caused the
  // resource parser to throw `InvalidZipFileError`, which surfaced as a
  // noisy "Cannot read <file>" toast (see #1448).
  //
  // We only know the file name here (no stat), so we keep entries
  // without an extension because they may be unzipped pack folders.
  const allowed = ALLOWED_EXTENSIONS[domain as ResourceDomain]
  if (allowed) {
    // A disabled resource keeps its real extension followed by
    // `.disabled` (e.g. `mymod.jar.disabled`). Strip it before checking.
    const name = file.endsWith('.disabled')
      ? file.slice(0, -'.disabled'.length)
      : file
    const lastDot = name.lastIndexOf('.')
    const lastSep = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
    if (lastDot > lastSep && lastDot < name.length - 1) {
      const ext = name.slice(lastDot).toLowerCase()
      if (!allowed.includes(ext)) {
        return true
      }
    }
  }

  return false
}

/**
 * The archive extensions each resource domain can actually parse. Files
 * with any other extension are skipped instead of being fed to the zip
 * parser (which would throw `InvalidZipFileError`). Entries without an
 * extension are kept because they may be unzipped pack folders.
 */
const ALLOWED_EXTENSIONS: Partial<Record<ResourceDomain, string[]>> = {
  [ResourceDomain.Mods]: ['.jar', '.litemod', '.zip'],
  [ResourceDomain.ResourcePacks]: ['.zip'],
  [ResourceDomain.ShaderPacks]: ['.zip'],
}
