import { MinecraftFolder } from '@xmcl/core'
import { open, readEntry, walkEntriesGenerator } from '@xmcl/unzip'
import { createHash } from 'crypto'
import { createWriteStream, existsSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { afterEach, expect, test } from 'vitest'
import { ZipFile } from 'yazl'
import { isForgeInstallerEntries, unpackForgeInstaller, walkForgeInstallerEntries } from './forge'
import { createLegacyForgeInstallWorkflow, createModernForgeInstallWorkflow } from './forgeWorkflow'
import { createNodeInstallRuntime, executeInstallManifest, executeInstallWorkflow } from './installManifest'
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

test('modern Forge install workflow emits primitive stages without materializing during planning', async ({ temp }) => {
  const minecraftVersion = '1.20.1'
  const forgeVersion = '1.20.1-47.3.0'
  const versionId = '1.20.1-forge-47.3.0'
  const root = join(temp, `forge-workflow-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)
  const installerPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`,
  )
  await mkdir(dirname(installerPath), { recursive: true })
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      profile: 'forge',
      version: versionId,
      minecraft: minecraftVersion,
      json: `/${versionId}.json`,
      path: `net.minecraftforge:forge:${forgeVersion}`,
      processors: [],
      libraries: [],
    }),
    'version.json': JSON.stringify({
      id: versionId,
      inheritsFrom: minecraftVersion,
      type: 'release',
      mainClass: 'example.Main',
      arguments: { game: [], jvm: [] },
      libraries: [],
    }),
    [`maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-universal.jar`]: 'jar',
  })
  const workflow = createModernForgeInstallWorkflow({
    id: 'forge',
    minecraft: mc,
    minecraftVersion,
    artifactVersion: forgeVersion,
    installer: { path: installerPath, urls: ['https://example.com/installer.jar'], validator: 'zip' },
    java: 'java',
    installOptions: {},
  })

  const downloadStage = await workflow.next()
  expect(downloadStage).toMatchObject({
    done: false,
    plan: { tasks: [{ type: 'files', files: [{ path: installerPath }] }] },
  })
  const materializeStage = await workflow.next()
  expect(materializeStage).toMatchObject({
    done: false,
    plan: { tasks: [{ type: 'materialize' }] },
  })
  expect(existsSync(mc.getVersionJson(versionId))).toBe(false)
})

test('modern Forge install workflow executes every primitive stage to completion', async ({ temp }) => {
  const minecraftVersion = '1.20.1'
  const forgeVersion = '1.20.1-47.3.0'
  const versionId = '1.20.1-forge-47.3.0'
  const root = join(temp, `forge-workflow-execute-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)
  const installerPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`,
  )
  await mkdir(dirname(installerPath), { recursive: true })
  await mkdir(dirname(mc.getVersionJson(minecraftVersion)), { recursive: true })
  await writeFile(mc.getVersionJson(minecraftVersion), JSON.stringify({
    id: minecraftVersion,
    type: 'release',
    mainClass: 'net.minecraft.client.main.Main',
    arguments: { game: [], jvm: [] },
    libraries: [],
  }))
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      profile: 'forge',
      version: versionId,
      minecraft: minecraftVersion,
      json: `/${versionId}.json`,
      path: `net.minecraftforge:forge:${forgeVersion}`,
      processors: [],
      libraries: [],
    }),
    'version.json': JSON.stringify({
      id: versionId,
      inheritsFrom: minecraftVersion,
      type: 'release',
      mainClass: 'example.Main',
      arguments: { game: [], jvm: [] },
      libraries: [],
    }),
  })

  const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({
    id: 'forge',
    minecraft: mc,
    minecraftVersion,
    artifactVersion: forgeVersion,
    installer: { path: installerPath, urls: ['https://example.com/installer.jar'], validator: 'zip' },
    java: 'java',
    installOptions: {},
  }), createNodeInstallRuntime())

  expect(result.version).toBe(versionId)
  expect(existsSync(mc.getVersionJson(versionId))).toBe(true)
})

test('modern NeoForge workflow materializes clientdata before running processors', async ({ temp }) => {
  const minecraftVersion = '26.1.2'
  const neoforgeVersion = '26.1.2.0-beta'
  const versionId = `neoforge-${neoforgeVersion}`
  const root = join(temp, `neoforge-workflow-clientdata-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)
  const installerPath = mc.getLibraryByPath(
    `net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`,
  )
  const processorName = 'example:processor:1.0'
  const processorPath = mc.getLibraryByPath('example/processor/1.0/processor-1.0.jar')
  const lzmaPath = mc.getLibraryByPath(
    `net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-clientdata.lzma`,
  )
  const lzmaContent = Buffer.from('NEOFORGE-CLIENTDATA')
  await mkdir(dirname(installerPath), { recursive: true })
  await mkdir(dirname(processorPath), { recursive: true })
  await mkdir(dirname(mc.getVersionJson(minecraftVersion)), { recursive: true })
  await writeFile(mc.getVersionJson(minecraftVersion), JSON.stringify({
    id: minecraftVersion,
    type: 'release',
    mainClass: 'net.minecraft.client.main.Main',
    arguments: { game: [], jvm: [] },
    libraries: [],
  }))
  await writeForgeInstallerJar(processorPath, {
    'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\r\nMain-Class: example.Processor\r\n\r\n',
  })
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      profile: 'neoforge',
      version: versionId,
      minecraft: minecraftVersion,
      json: `/${versionId}.json`,
      data: { BINPATCH: { client: '/data/client.lzma', server: '/data/client.lzma' } },
      processors: [{ jar: processorName, classpath: [], args: ['{BINPATCH}'], sides: ['client'] }],
      libraries: [{ name: processorName }],
    }),
    'version.json': JSON.stringify({
      id: versionId,
      inheritsFrom: minecraftVersion,
      type: 'release',
      mainClass: 'example.Main',
      arguments: { game: [], jvm: [] },
      libraries: [],
    }),
    'data/client.lzma': lzmaContent,
  })

  const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({
    id: 'neoforge',
    minecraft: mc,
    minecraftVersion,
    artifactVersion: neoforgeVersion,
    installer: { path: installerPath, urls: ['https://example.com/installer.jar'], validator: 'zip' },
    java: 'java',
    installOptions: {},
    side: 'client',
  }), createNodeInstallRuntime({
    runJava: async (command) => {
      expect(command.args).toContain(lzmaPath)
      expect(await readFile(lzmaPath)).toEqual(lzmaContent)
    },
  }))

  expect(result.version).toBe(versionId)
  expect(await readFile(lzmaPath)).toEqual(lzmaContent)
})

test('Forge install workflow supports legacy versionInfo installers', async ({ temp }) => {
  const minecraftVersion = '1.8.9'
  const forgeVersion = '1.8.9-11.15.1.2318-1.8.9'
  const versionId = '1.8.9-forge1.8.9-11.15.1.2318-1.8.9'
  const root = join(temp, `forge-legacy-workflow-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)
  const installerPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`,
  )
  const universalPath = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar`,
  )
  const universalContent = Buffer.from('legacy-universal')
  const universalSha1 = createHash('sha1').update(universalContent).digest('hex')
  await mkdir(dirname(installerPath), { recursive: true })
  await mkdir(dirname(mc.getVersionJson(minecraftVersion)), { recursive: true })
  await writeFile(mc.getVersionJson(minecraftVersion), JSON.stringify({
    id: minecraftVersion,
    type: 'release',
    mainClass: 'net.minecraft.client.main.Main',
    minecraftArguments: '',
    libraries: [],
  }))
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      profile: 'forge',
      version: versionId,
      json: `/${versionId}.json`,
      path: `net.minecraftforge:forge:${forgeVersion}`,
      versionInfo: {
        id: versionId,
        inheritsFrom: minecraftVersion,
        type: 'release',
        mainClass: 'net.minecraft.launchwrapper.Launch',
        minecraftArguments: '--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker',
        libraries: [{
          name: `net.minecraftforge:forge:${forgeVersion}`,
          url: 'https://example.com/',
          checksums: [universalSha1],
        }],
      },
    }),
    [`forge-${forgeVersion}-universal.jar`]: universalContent,
  })

  const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({
    id: 'forge',
    minecraft: mc,
    minecraftVersion,
    artifactVersion: forgeVersion,
    installer: { path: installerPath, urls: ['https://example.com/installer.jar'], validator: 'zip' },
    java: 'java',
    installOptions: {},
  }), createNodeInstallRuntime())

  expect(result.version).toBe(versionId)
  expect(JSON.parse(await readFile(mc.getVersionJson(versionId), 'utf8'))).toMatchObject({
    id: versionId,
    inheritsFrom: minecraftVersion,
  })
  await expect(readFile(universalPath, 'utf8')).resolves.toBe('legacy-universal')
})

test('Forge install workflow merges Minecraft 1.4 universal ZIPs', async ({ temp }) => {
  const minecraftVersion = '1.4.7'
  const forgeVersion = '1.4.7-6.6.2.534'
  const root = join(temp, `forge-universal-workflow-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)
  const minecraftJar = mc.getVersionJar(minecraftVersion)
  const universal = mc.getLibraryByPath(
    `net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-universal.zip`,
  )
  await mkdir(dirname(minecraftJar), { recursive: true })
  await mkdir(dirname(universal), { recursive: true })
  await writeForgeInstallerJar(minecraftJar, {
    'base.txt': 'base',
    'shared.txt': 'minecraft',
    'META-INF/MOJANG.SF': 'signature',
  })
  await writeForgeInstallerJar(universal, {
    'forge.txt': 'forge',
    'shared.txt': 'forge-wins',
    'META-INF/FORGE.SF': 'signature',
  })

  const workflow = createLegacyForgeInstallWorkflow({
    id: 'forge',
    minecraft: mc,
    minecraftVersion,
    artifactVersion: forgeVersion,
    universal: { path: universal, urls: ['https://example.com/universal.zip'], validator: 'zip' },
    installOptions: {},
  })
  const input = await workflow.next()
  if (input.done) throw new Error('Missing legacy universal input stage')
  await executeInstallManifest(input.plan, createNodeInstallRuntime())
  const materialize = await workflow.next()
  if (materialize.done) throw new Error('Missing legacy universal materialization')
  await executeInstallManifest(materialize.plan, createNodeInstallRuntime())

  const output = mc.getLibraryByPath(`net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar`)
  const zip = await open(output, { lazyEntries: true, autoClose: false })
  try {
    const contents = new Map<string, string>()
    for await (const entry of walkEntriesGenerator(zip)) {
      contents.set(entry.fileName, (await readEntry(zip, entry)).toString())
    }
    expect(contents).toEqual(new Map([
      ['base.txt', 'base'],
      ['shared.txt', 'forge-wins'],
      ['forge.txt', 'forge'],
    ]))
  } finally {
    zip.close()
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

// Regression test for modern NeoForge installers (>=26.x / installertools 4.x)
// which ship a SINGLE `data/client.lzma` bundle used by BOTH sides. The
// install_profile points `BINPATCH.client` and `BINPATCH.server` at
// `/data/client.lzma` and there is no `data/server.lzma` entry. If the server
// BINPATCH is not rewritten to the extracted maven artifact, the
// `PROCESS_MINECRAFT_JAR` processor fails with
// `FileNotFoundException: /data/client.lzma`.
test('unpackForgeInstaller rewrites BINPATCH for both sides when only client.lzma exists', async ({ temp }) => {
  const minecraftVersion = '26.1.2'
  const neoforgeVersion = '26.1.2.76'
  const versionId = `neoforge-${neoforgeVersion}`

  const root = join(temp, `neoforge-binpatch-${Date.now()}`)
  cleanup = root
  const mc = MinecraftFolder.from(root)

  const installerPath = mc.getLibraryByPath(
    `net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`,
  )
  await mkdir(dirname(installerPath), { recursive: true })

  const lzmaContent = Buffer.from('NEOFORGE-CLIENT-BINPATCH-BUNDLE')
  await writeForgeInstallerJar(installerPath, {
    'install_profile.json': JSON.stringify({
      spec: 1,
      profile: 'neoforge',
      version: versionId,
      minecraft: minecraftVersion,
      json: `/${versionId}.json`,
      path: `net.neoforged:neoforge:${neoforgeVersion}`,
      data: {
        BINPATCH: { client: '/data/client.lzma', server: '/data/client.lzma' },
      },
      processors: [],
      libraries: [],
    }),
    'version.json': JSON.stringify({
      id: versionId,
      inheritsFrom: minecraftVersion,
      type: 'release',
      mainClass: '',
      arguments: { game: [], jvm: [] },
      libraries: [],
    }),
    'data/client.lzma': lzmaContent,
  })

  const zip = await open(installerPath, { lazyEntries: true, autoClose: false })
  try {
    const entries = await walkForgeInstallerEntries(zip, neoforgeVersion)

    expect(entries.clientLzma).toBeDefined()
    expect(entries.serverLzma).toBeUndefined()
    if (!isForgeInstallerEntries(entries)) throw new Error('unreachable')

    const profile: InstallProfile = {
      profile: 'neoforge',
      version: versionId,
      json: `/${versionId}.json`,
      path: `net.neoforged:neoforge:${neoforgeVersion}`,
      minecraft: minecraftVersion,
      data: {
        BINPATCH: { client: '/data/client.lzma', server: '/data/client.lzma' },
      },
      processors: [],
      libraries: [],
    }

    await unpackForgeInstaller(zip, entries, profile, mc, installerPath, {})

    // Both sides must reference the extracted clientdata maven artifact, not the
    // in-jar `/data/client.lzma` path.
    expect(profile.data.BINPATCH.client).toBe(
      `[net.neoforged:neoforge:${neoforgeVersion}:clientdata@lzma]`,
    )
    expect(profile.data.BINPATCH.server).toBe(
      `[net.neoforged:neoforge:${neoforgeVersion}:clientdata@lzma]`,
    )
  } finally {
    zip.close()
  }

  // The client bundle must be extracted to its maven library path.
  const lzmaPath = mc.getLibraryByPath(
    `net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-clientdata.lzma`,
  )
  expect(existsSync(lzmaPath)).toBe(true)
  const extractedLzma = await readFile(lzmaPath)
  expect(extractedLzma.equals(lzmaContent)).toBe(true)
})
