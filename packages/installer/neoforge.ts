import { MinecraftFolder, Version as VersionJson } from '@xmcl/core'
import {
  InstallForgeOptions,
} from './forge'
import { resolveLibraryDownloadUrls } from './libraries'
import { type InstallFile } from './installManifest'
import { doFetch, normalizeArray } from './utils.browser'

/**
 * Fetch the sha1 checksum published next to a maven artifact (the `.sha1`
 * sidecar). Returns an empty string when the checksum cannot be retrieved so
 * callers can gracefully fall back to no verification.
 */
async function fetchMavenSha1(options: InstallForgeOptions, url: string): Promise<string> {
  try {
    const response = await doFetch(options, `${url}.sha1`)
    if (!response.ok) return ''
    const text = (await response.text()).trim()
    // The sidecar may be just the digest, or `<digest>  <filename>`.
    const digest = text.split(/\s+/)[0]?.toLowerCase() ?? ''
    return /^[a-f0-9]{40}$/.test(digest) ? digest : ''
  } catch {
    return ''
  }
}

async function fetchMavenSize(options: InstallForgeOptions, url: string): Promise<number | undefined> {
  try {
    const response = await doFetch(options, url, { method: 'HEAD' })
    if (!response.ok) return undefined
    const size = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    return Number.isSafeInteger(size) && size >= 0 ? size : undefined
  } catch {
    return undefined
  }
}

export async function resolveNeoForgedInstallerFile(
  project: 'forge' | 'neoforge',
  version: string,
  minecraft: MinecraftFolder,
  options: InstallForgeOptions,
): Promise<{ file: InstallFile; source: string }> {
  const url = `https://maven.neoforged.net/releases/net/neoforged/${project}/${version}/${project}-${version}-installer.jar`

  // The installer jar is the single input the whole install pipeline derives
  // from (it carries `data/client.lzma`, which the binpatcher applies). A
  // size-correct but content-corrupt download here silently produces an empty
  // binpatched client jar, so validate it against the published sha1.
  const [expectedSha1, expectedSize] = await Promise.all([
    fetchMavenSha1(options, url),
    fetchMavenSize(options, url),
  ])

  const library = VersionJson.resolveLibrary({
    name: `net.neoforged:${project}:${version}:installer`,
    downloads: {
      artifact: {
        url,
        path: `net/neoforged/${project}/${version}/${project}-${version}-installer.jar`,
        size: expectedSize ?? -1,
        sha1: expectedSha1,
      },
    },
  })!
  const mavenHost = options.mavenHost ? normalizeArray(options.mavenHost) : []

  const urls = resolveLibraryDownloadUrls(library, { ...options, mavenHost } as any) // cast to avoid tracker type issue

  const installJarPath = minecraft.getLibraryByPath(library.path)
  const file: InstallFile = {
    path: installJarPath,
    urls,
    size: expectedSize,
    checksum: expectedSha1 ? { algorithm: 'sha1', value: expectedSha1 } : undefined,
    validator: 'zip',
    validatedAt: options.timestamp,
  }
  return { file, source: url }
}
