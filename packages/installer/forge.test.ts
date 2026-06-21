import { MinecraftFolder } from '@xmcl/core'
import { open } from '@xmcl/unzip'
import { createWriteStream, existsSync } from 'fs'
import { mkdir, readFile, rm } from 'fs/promises'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { afterEach, expect, test } from 'vitest'
import { ZipFile } from 'yazl'
import { isForgeInstallerEntries, unpackForgeInstaller, walkForgeInstallerEntries } from './forge'
import type { InstallProfile } from './profile'

/**
 * Build a minimal but structurally-valid modern (>=1.13) forge *installer* jar
 * on disk at `dest`. Only the entries relevant to {@link unpackForgeInstaller}
 * are included.
 */
async function writeForgeInstallerJar(dest: string, files: Record<string, Buffer | string>) {
  const zip = new ZipFile()
  for (const [name, content] of Object.entries(files)) {
    zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content), name)
  }
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(dest))
}

let cleanup: string | undefined

afterEach(async () => {
  if (cleanup) {
    await rm(cleanup, { recursive: true, force: true }).catch(() => {})
    cleanup = undefined
  }
})

// Regression test for the bootstrap-shim jar of modern Forge servers.
//
// The installer bundles `forge-<version>-shim.jar` under `maven/...`. It is the
// server launch entrypoint (`java -jar forge-<version>-shim.jar`) and, for
// versions where it is not published as a downloadable library, it MUST be
// extracted from the installer. If it is missing the server dies with
// `unable to access jarfile forge-<version>-shim.jar`.
test('unpackForgeInstaller extracts the bootstrap shim jar to the library path', async ({ temp }) => {
  const minecraftVersion = '26.1.2'
  const forgeVersion = '26.1.2-64.0.8'
  const versionId = '26.1.2-forge-64.0.8'

  const root = join(temp, `forge-shim-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)

  // The real flow downloads the installer jar into the forge maven version
  // directory; `unpackForgeInstaller` derives the maven coords from that path.
  const installerPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`,
  )
  await mkdir(dirname(installerPath), { recursive: true })

  const shimContent = Buffer.from('FORGE-BOOTSTRAP-SHIM-JAR-CONTENT')
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      spec: 1,
      profile: 'forge',
      version: versionId,
      minecraft: minecraftVersion,
      json: `/${versionId}.json`,
      path: `net.minecraftforge:forge:${forgeVersion}`,
      data: {},
      processors: [],
      libraries: [],
    }),
    'version.json': JSON.stringify({
      id: versionId,
      inheritsFrom: minecraftVersion,
      type: 'release',
      mainClass: 'net.minecraftforge.bootstrap.shim.Main',
      arguments: { game: [], jvm: [] },
      libraries: [],
    }),
    [`maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-shim.jar`]: shimContent,
  })

  const zip = await open(installerPath, { lazyEntries: true, autoClose: false })
  try {
    const entries = await walkForgeInstallerEntries(zip, forgeVersion)

    // The installer really does contain the shim entry.
    expect(entries.shimJar).toBeDefined()
    expect(isForgeInstallerEntries(entries)).toBe(true)
    if (!isForgeInstallerEntries(entries)) throw new Error('unreachable')

    const profile: InstallProfile = {
      profile: 'forge',
      version: versionId,
      json: `/${versionId}.json`,
      path: `net.minecraftforge:forge:${forgeVersion}`,
      minecraft: minecraftVersion,
      data: {},
      processors: [],
      libraries: [],
    }

    const id = await unpackForgeInstaller(zip, entries, profile, mc, installerPath, {})
    expect(id).toBe(versionId)
  } finally {
    zip.close()
  }

  // The shim jar must land at the library path the server launch reads from.
  const shimPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-shim.jar`,
  )
  expect(existsSync(shimPath)).toBe(true)
  const extracted = await readFile(shimPath)
  expect(extracted.equals(shimContent)).toBe(true)
})
