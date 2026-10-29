import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { delimiter, dirname, join } from 'path'
import { afterEach, expect, test, vi } from 'vitest'
import { ZipFile } from 'yazl'
import { createModernForgeInstallWorkflow, createProfileInstallWorkflow } from './forgeWorkflow'
import { createNodeInstallRuntime, executeInstallManifest, executeInstallWorkflow, type InstallFile } from './installManifest'
import type { InstallProfile } from './profile'
import { resolveForgeServerProfileTasks } from './serverProfile'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function zip(files: Record<string, string | Buffer>) {
  const archive = new ZipFile()
  for (const [name, content] of Object.entries(files)) archive.addBuffer(Buffer.from(content), name)
  archive.end()
  const chunks: Buffer[] = []
  for await (const chunk of archive.outputStream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function put(path: string, content: string | Buffer) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-forge-server-'))
  roots.push(root)
  const minecraft = MinecraftFolder.from(root)
  const jar = await zip({ 'fixture.txt': 'synthetic dependency' })
  const download = vi.fn(async (files: InstallFile[]) => {
    for (const file of files) await put(file.path, jar)
  })
  const runtime = createNodeInstallRuntime({ download })
  return { minecraft, runtime, download, jar }
}

function libraryPath(mc: MinecraftFolder, name: string) {
  return mc.getLibraryByPath(LibraryInfo.resolve(name).path)
}

function versionJson(id: string, libraries: Version['libraries'] = []) {
  return {
    id,
    inheritsFrom: '1.20.1',
    mainClass: 'client.Main',
    type: 'release',
    arguments: { game: [], jvm: [] },
    libraries,
  }
}

function profile(version: string, path = 'net.minecraftforge:forge:1.20.1-47.3.0'): InstallProfile {
  return { profile: 'forge', version, minecraft: '1.20.1', path, json: '/version.json', libraries: [], processors: [] }
}

async function modernInstaller(mc: MinecraftFolder, installProfile: InstallProfile, files: Record<string, string | Buffer>, client = versionJson(installProfile.version)) {
  const installer = libraryPath(mc, `${installProfile.path}:installer`)
  await put(installer, await zip({
    'install_profile.json': JSON.stringify(installProfile),
    'version.json': JSON.stringify(client),
    ...files,
  }))
  return {
    id: 'forge', minecraft: mc, minecraftVersion: installProfile.minecraft,
    artifactVersion: installProfile.path.split(':')[2],
    installer: { path: installer, urls: [], validator: 'zip' as const },
    java: 'unused-java', installOptions: {}, side: 'server' as const,
  }
}

test('1.7.10 legacy installer emits a server manifest without requiring a vanilla client profile', async () => {
  const { minecraft: mc, runtime, download } = await setup()
  const artifact = '1.7.10-10.13.4.1614-1.7.10'
  const name = `net.minecraftforge:forge:${artifact}`
  const id = '1.7.10-forge'
  const dependency = 'net.minecraft:launchwrapper:1.12'
  const scala = 'org.scala-lang:scala-library:2.11.1'
  const installer = libraryPath(mc, `${name}:installer`)
  await put(installer, await zip({
    'install_profile.json': JSON.stringify({
      install: { minecraft: '1.7.10' },
      versionInfo: {
        ...versionJson(id, [{ name }, { name: dependency, url: 'https://fixture.invalid/maven/' }]),
        inheritsFrom: '1.7.10',
      },
    }),
    [`forge-${artifact}-universal.jar`]: await zip({
      'META-INF/MANIFEST.MF': `Manifest-Version: 1.0\nMain-Class: cpw.mods.fml.relauncher.ServerLaunchWrapper\nClass-Path: minecraft_server.1.7.10.jar libraries/${LibraryInfo.resolve(scala).path}\n\n`,
    }),
  }))
  const workflow = createModernForgeInstallWorkflow({
    id: 'legacy', minecraft: mc, minecraftVersion: '1.7.10', artifactVersion: artifact,
    installer: { path: installer, urls: [], validator: 'zip' }, java: 'unused', side: 'server', installOptions: {},
  })
  // Inspect the final stage before executing it: planning must not write.
  for (let i = 0; i < 2; i++) {
    const step = await workflow.next()
    if (step.done) throw new Error('Missing initial stage')
    await executeInstallManifest(step.plan, runtime)
  }
  const final = await workflow.next()
  if (final.done) throw new Error('Missing server stage')
  await expect(readFile(mc.getVersionServerJson(id))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(final.plan.tasks.map((t) => t.type)).toEqual(['files', 'materialize'])
  await executeInstallManifest(final.plan, runtime)
  const server = await Version.parseServer(mc, id)
  expect(server.mainClass).toBe('cpw.mods.fml.relauncher.ServerLaunchWrapper')
  expect(server.minecraftVersion).toBe('1.7.10')
  expect(server.libraries.map((l) => l.name)).toEqual(expect.arrayContaining([name, dependency, scala]))
  expect(download.mock.calls.flatMap(([files]) => files).map((f) => f.path)).toEqual(expect.arrayContaining([
    libraryPath(mc, dependency), libraryPath(mc, scala),
  ]))
  const result = await workflow.next()
  expect(result).toMatchObject({ done: true, result: { version: id } })
  if (!result.done) throw new Error('Workflow did not finish')
  await rm(mc.getVersionServerJson(id))
  await executeInstallWorkflow(createProfileInstallWorkflow({
    id: 'legacy-repair', minecraft: mc, profile: result.result.profile,
    java: 'unused', side: 'server', installOptions: {},
  }), runtime)
  expect((await Version.parseServer(mc, id)).mainClass).toBe('cpw.mods.fml.relauncher.ServerLaunchWrapper')
})

test.each(['forge', 'neoforge'])('%s args mode preserves server classpath and repairs overridden profiles after processors', async (loader) => {
  const { minecraft: mc, download, jar } = await setup()
  const id = `${loader}-server`
  const customId = `${id}-custom`
  const p = profile(id, loader === 'forge' ? 'net.minecraftforge:forge:1.20.1-47.3.0' : 'net.neoforged:neoforge:21.1.0')
  const main = loader === 'forge' ? 'cpw.mods.bootstraplauncher.BootstrapLauncher' : 'net.neoforged.fml.startup.Server'
  const launcher = 'net.neoforged.fancymodloader:loader:4.0.0'
  const native = 'io.netty:netty-transport-native-epoll:4.2.7.Final:linux-x86_64'
  const log4j = 'org.apache.logging.log4j:log4j-core:2.24.0'
  const module = 'cpw.mods:securejarhandler:2.1.0'
  const universal = `${p.path}:universal`
  const processor = 'fixture:processor:1'
  const classpath = [launcher, native, log4j].map((n) => `libraries/${LibraryInfo.resolve(n).path}`).join(delimiter)
  const args = `-p libraries/${LibraryInfo.resolve(module).path}\n--add-modules ALL-MODULE-PATH\n-DlibraryDirectory=libraries\n-classpath ${classpath}\n${main}\n--launchTarget forgeserver\n--fml.neoFormVersion 20240808.144430\n`
  const argsName = process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt'
  p.libraries = [{ name: processor }, { name: universal }]
  p.processors = [{
    jar: processor, classpath: [], sides: ['server'],
    args: loader === 'forge'
      ? ['--from', `data/${argsName}`, '--to', `{ROOT}/libraries/${LibraryInfo.resolve(p.path).path.replace(/[^/]+$/, argsName)}`]
      : ['{ROOT}/marker'],
  }]
  await put(libraryPath(mc, processor), await zip({ 'META-INF/MANIFEST.MF': 'Main-Class: fixture.Processor\r\n' }))
  await put(libraryPath(mc, universal), jar)
  const options = await modernInstaller(mc, p, { [`data/${argsName}`]: args }, versionJson(id, [
    { name: launcher, url: 'https://fixture.invalid/fml/' },
    { name: 'net.minecraft:client:1.20.1' },
  ]))
  const runJava = vi.fn(async () => {
    // Bundler outputs exist only AFTER Java execution; they are absent from
    // the client profile and must still survive into the server classpath.
    await put(libraryPath(mc, native), jar)
    await put(libraryPath(mc, log4j), jar)
  })
  const runtime = createNodeInstallRuntime({ download, runJava })
  const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({
    ...options, installOptions: { versionId: customId },
  }), runtime)
  expect(runJava).toHaveBeenCalledOnce()
  const server = await Version.parseServer(mc, customId)
  expect(server.mainClass).toBe(main)
  expect(server.libraries.map((l) => l.name)).toEqual([launcher, native, log4j])
  expect(server.arguments.jvm).not.toContain('-classpath')
  expect(server.arguments.jvm).toContain('libraries/' + LibraryInfo.resolve(module).path)
  expect(server.arguments.jvm).toContain('-DlibraryDirectory=libraries')
  const downloaded = download.mock.calls.flatMap(([files]) => files)
  expect(downloaded.find((f) => f.path === libraryPath(mc, launcher))?.urls).toContain(
    'https://fixture.invalid/fml/' + LibraryInfo.resolve(launcher).path,
  )
  expect(downloaded.map((f) => f.path)).not.toContain(libraryPath(mc, 'net.minecraft:client:1.20.1'))
  expect(downloaded.some((f) => /-(extra|srg)\.jar$/.test(f.path))).toBe(false)
  expect(result.profile.version).toBe(customId)
  const saved: InstallProfile = JSON.parse(await readFile(join(mc.getVersionRoot(customId), 'install_profile.json'), 'utf8'))
  expect(saved.version).toBe(customId)
  await put(mc.getVersionServerJson(customId), '{"mainClass":"stale.Main"}')
  await executeInstallWorkflow(createProfileInstallWorkflow({
    id: 'repair', profile: saved, minecraft: mc, java: 'unused-java', installOptions: {}, side: 'server',
  }), runtime)
  expect((await Version.parseServer(mc, customId)).mainClass).toBe(main)
  await rm(mc.getVersionServerJson(customId))
  await executeInstallWorkflow(createProfileInstallWorkflow({
    id: 'repair-missing', profile: saved, minecraft: mc, java: 'unused-java', installOptions: {}, side: 'server',
  }), runtime)
  expect((await Version.parseServer(mc, customId)).libraries.map((l) => l.name)).toEqual([launcher, native, log4j])
})

test('Forge shim mode extracts the executable and installs bootstrap-shim.list dependencies', async () => {
  const { minecraft: mc, runtime } = await setup()
  const p = profile('forge-shim')
  const artifact = p.path.split(':')[2]
  const shimName = `${p.path}:shim`
  const loader = 'net.minecraftforge:fmlloader:1.20.1-47.3.0'
  const args = `-Djava.net.preferIPv6Addresses=system\n-jar forge-${artifact}-shim.jar\n--launchTarget forgeserver\n`
  const options = await modernInstaller(mc, p, {
    'data/win_args.txt': args,
    'data/unix_args.txt': args,
    [`maven/${LibraryInfo.resolve(shimName).path}`]: await zip({
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\r\nMain-Class: net.minecraftforge.bootstrap.shim.Main\r\n\r\n',
      'bootstrap-shim.list': `ignored-sha1\t${loader}\t${LibraryInfo.resolve(loader).path}\n`,
    }),
  }, versionJson(p.version, [{ name: 'net.minecraft:client:1.20.1' }]))
  await executeInstallWorkflow(createModernForgeInstallWorkflow(options), runtime)
  const server = await Version.parseServer(mc, p.version)
  expect(server.mainClass).toBe('net.minecraftforge.bootstrap.shim.Main')
  expect(server.libraries.map((l) => l.name)).toEqual([shimName, loader])
  expect(server.arguments.game).toEqual(['--launchTarget', 'forgeserver'])
  expect(server.arguments.jvm).not.toContain('-jar')
  await expect(readFile(libraryPath(mc, shimName))).resolves.toBeDefined()
})

test('pre-args modern Forge uses the processed server jar manifest', async () => {
  const { minecraft: mc, runtime } = await setup()
  const p = profile('forge-1.16', 'net.minecraftforge:forge:1.16.5-36.2.0')
  const options = await modernInstaller(mc, p, {
    [`maven/${LibraryInfo.resolve(p.path).path}`]: await zip({
      'META-INF/MANIFEST.MF': 'Main-Class: net.minecraftforge.server.ServerMain\r\n\r\n',
    }),
  })
  await executeInstallWorkflow(createModernForgeInstallWorkflow(options), runtime)
  expect((await Version.parseServer(mc, p.version)).mainClass).toBe('net.minecraftforge.server.ServerMain')
})

test('missing main class fails without publishing server.json', async () => {
  const { minecraft: mc } = await setup()
  const p = profile('bad-server')
  await put(mc.getVersionJson(p.version), JSON.stringify(versionJson(p.version)))
  await put(libraryPath(mc, p.path), await zip({ 'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\r\n' }))
  await expect(resolveForgeServerProfileTasks({ id: 'bad', minecraft: mc, profile: p, installOptions: {} }))
    .rejects.toMatchObject({ name: 'PostProcessNoMainClassError' })
  await expect(readFile(mc.getVersionServerJson(p.version))).rejects.toMatchObject({ code: 'ENOENT' })
})

test('client install and client profile repair do not generate a server profile', async () => {
  const { minecraft: mc, runtime } = await setup()
  const p = profile('client-only')
  await put(mc.getVersionJson('1.20.1'), JSON.stringify({ ...versionJson('1.20.1'), inheritsFrom: undefined }))
  const options = await modernInstaller(mc, p, {})
  const result = await executeInstallWorkflow(createModernForgeInstallWorkflow({ ...options, side: 'client' }), runtime)
  await executeInstallWorkflow(createProfileInstallWorkflow({
    id: 'client-repair', minecraft: mc, profile: result.profile, java: 'unused', installOptions: {},
  }), runtime)
  await expect(readFile(mc.getVersionServerJson(p.version))).rejects.toMatchObject({ code: 'ENOENT' })
  expect((await Version.parse(mc, p.version)).mainClass).toBe('client.Main')
})
