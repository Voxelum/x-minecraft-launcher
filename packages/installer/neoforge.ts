import { MinecraftFolder, MinecraftLocation, Version as VersionJson } from '@xmcl/core'
import { download, getDownloadBaseOptions } from '@xmcl/file-transfer'
import { open, readEntry } from '@xmcl/unzip'
import { unlink } from 'fs/promises'
import {
  BadForgeInstallerJarError,
  InstallForgeOptions,
  isForgeInstallerEntries,
  unpackForgeInstaller,
  walkForgeInstallerEntries,
} from './forge'
import { resolveLibraryDownloadUrls } from './libraries'
import { InstallProfile, installByProfile } from './profile'
import { onDownloadSingle } from './tracker'
import { checksum } from './utils'
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

async function downloadNeoForgedInstaller(
  project: 'forge' | 'neoforge',
  version: string,
  minecraft: MinecraftFolder,
  options: InstallForgeOptions,
): Promise<string> {
  const url = `https://maven.neoforged.net/releases/net/neoforged/${project}/${version}/${project}-${version}-installer.jar`

  // The installer jar is the single input the whole install pipeline derives
  // from (it carries `data/client.lzma`, which the binpatcher applies). A
  // size-correct but content-corrupt download here silently produces an empty
  // binpatched client jar, so validate it against the published sha1.
  const expectedSha1 = await fetchMavenSha1(options, url)

  const library = VersionJson.resolveLibrary({
    name: `net.neoforged:${project}:${version}:installer`,
    downloads: {
      artifact: {
        url,
        path: `net/neoforged/${project}/${version}/${project}-${version}-installer.jar`,
        size: -1,
        sha1: expectedSha1,
      },
    },
  })!
  const mavenHost = options.mavenHost ? normalizeArray(options.mavenHost) : []

  const urls = resolveLibraryDownloadUrls(library, { ...options, mavenHost } as any) // cast to avoid tracker type issue

  const installJarPath = minecraft.getLibraryByPath(library.path)

  const doDownload = () =>
    download({
      url: urls,
      destination: installJarPath,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadSingle(options.tracker, 'forge.installer', { version, path: url }),
      signal: options.signal,
    })

  if (!expectedSha1) {
    // No published checksum available; fall back to a plain download.
    await doDownload()
    return installJarPath
  }

  const checksumFn = options.checksum ?? checksum

  // Reuse a valid cached installer; otherwise (re)download and verify, retrying
  // a couple of times to recover from a transient corrupt download.
  let actualSha1 = await checksumFn(installJarPath, 'sha1').catch(() => '')
  for (let attempt = 0; attempt < 3 && actualSha1 !== expectedSha1; attempt++) {
    await unlink(installJarPath).catch(() => {})
    await doDownload()
    actualSha1 = await checksumFn(installJarPath, 'sha1').catch(() => '')
  }

  if (actualSha1 !== expectedSha1) {
    // Remove the corrupt jar so the next attempt starts from a clean download.
    await unlink(installJarPath).catch(() => {})
    throw new BadForgeInstallerJarError(installJarPath)
  }

  return installJarPath
}

export async function installNeoForge(
  project: 'forge' | 'neoforge',
  version: string,
  minecraft: MinecraftLocation,
  options: InstallForgeOptions = {},
): Promise<string> {
  const [_, forgeVersion = version] = version.split('-')
  const mc = MinecraftFolder.from(minecraft)
  const jarPath = await downloadNeoForgedInstaller(project, version, mc, options)

  const zip = await open(jarPath, { lazyEntries: true, autoClose: false })
  const entries = await walkForgeInstallerEntries(zip, forgeVersion)

  if (!entries.installProfileJson) {
    throw new BadForgeInstallerJarError(jarPath, 'install_profile.json')
  }
  const profile: InstallProfile = await readEntry(zip, entries.installProfileJson)
    .then((b) => b.toString())
    .then(JSON.parse)
  if (isForgeInstallerEntries(entries)) {
    // new forge
    const versionId = await unpackForgeInstaller(zip, entries, profile, mc, jarPath, options)
    await installByProfile(profile, minecraft, options)
    return versionId
  } else {
    // bad forge
    throw new BadForgeInstallerJarError(jarPath)
  }
}
