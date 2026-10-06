import { createWriteStream } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { delimiter, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { afterEach, expect, test } from 'vitest'
import { ZipFile } from 'yazl'
import { MinecraftFolder } from '@xmcl/core'
import { createNodeInstallRuntime, executeInstallWorkflow } from './installManifest'
import { createProfileInstallWorkflow } from './forgeWorkflow'
import { classpathEntryToLibraryName, diagnoseProcessorOutputs, diagnoseProfile, isEmptyOrCorruptArchive, parseArgumentsFromArgsFile, resolvePostProcessJavaTask, resolveProcessors, type InstallProfile } from './profile'

let cleanup: string | undefined

afterEach(async () => {
  if (cleanup) {
    await rm(cleanup, { recursive: true, force: true }).catch(() => {})
    cleanup = undefined
  }
})

async function writeArchive(dest: string, content: Buffer) {
  const zip = new ZipFile()
  zip.addBuffer(content, 'data.bin')
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(dest))
}

async function writeProcessorArchive(dest: string, mainClass: string) {
  await mkdir(dirname(dest), { recursive: true })
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from(`Manifest-Version: 1.0\nMain-Class: ${mainClass}\n`), 'META-INF/MANIFEST.MF')
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(dest))
}

function emptyServerProfile() {
  return {
    mainClass: '',
    arguments: { jvm: [] as string[], game: [] as string[] },
  } as any
}

const parentDir = join('mc', 'libraries', 'net', 'minecraftforge', 'forge', '26.1.2-64.0.8')

// Regression: modern Forge (e.g. mc 26.1.2 / forge 64.0.8) ships a server
// args file that mixes a standalone `-XX:...` flag with a `-jar <shim>`
// terminator. The old heuristic treated every non `-D` option as a flag/value
// pair, swallowed `-jar` as the value of `-XX:+UseCompactObjectHeaders`, and
// mistook the shim filename for the main class.
test('parseArgumentsFromArgsFile handles a -jar terminator after standalone JVM flags', () => {
  const profile = emptyServerProfile()
  const content = [
    '-Djava.net.preferIPv6Addresses=system',
    '-XX:+UseCompactObjectHeaders',
    '-jar',
    'forge-26.1.2-64.0.8-shim.jar',
  ].join('\n')

  const jar = parseArgumentsFromArgsFile(content, parentDir, profile)

  expect(jar).toBe(join(parentDir, 'forge-26.1.2-64.0.8-shim.jar'))
  expect(profile.mainClass).toBe('')
  expect(profile.arguments.jvm).toEqual([
    '-Djava.net.preferIPv6Addresses=system',
    '-XX:+UseCompactObjectHeaders',
  ])
  expect(profile.arguments.game).toEqual([])
})

// Older module-path style server args file: value-taking module options are
// paired with their value, and a bare main-class token terminates the jvm args.
test('parseArgumentsFromArgsFile handles module-path options and a bare main class', () => {
  const profile = emptyServerProfile()
  const content = [
    '-p',
    'libraries/cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar',
    '--add-modules',
    'ALL-MODULE-PATH',
    '--add-opens',
    'java.base/java.util.jar=cpw.mods.securejarhandler',
    '-DignoreList=foo',
    'cpw.mods.bootstraplauncher.BootstrapLauncher',
  ].join('\n')

  const jar = parseArgumentsFromArgsFile(content, parentDir, profile)

  expect(jar).toBeUndefined()
  expect(profile.mainClass).toBe('cpw.mods.bootstraplauncher.BootstrapLauncher')
  expect(profile.arguments.jvm).toEqual([
    '-p',
    'libraries/cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar',
    '--add-modules',
    'ALL-MODULE-PATH',
    '--add-opens',
    'java.base/java.util.jar=cpw.mods.securejarhandler',
    '-DignoreList=foo',
  ])
  expect(profile.arguments.game).toEqual([])
})

// Tokens after the `-jar <jar>` terminator are program/game arguments.
test('parseArgumentsFromArgsFile collects game args after the executable jar', () => {
  const profile = emptyServerProfile()
  const content = ['-Xmx2G', '-jar', 'server.jar', '--nogui', 'extra'].join('\n')

  const jar = parseArgumentsFromArgsFile(content, parentDir, profile)

  expect(jar).toBe(join(parentDir, 'server.jar'))
  expect(profile.arguments.jvm).toEqual(['-Xmx2G'])
  expect(profile.arguments.game).toEqual(['--nogui', 'extra'])
})

// `classpathEntryToLibraryName` converts a server `-classpath` entry (a path
// relative to the minecraft root) back into a maven coordinate so the server
// launch classpath can be reconstructed from server.json libraries.
test('classpathEntryToLibraryName converts a plain library path', () => {
  expect(
    classpathEntryToLibraryName(
      'libraries/org/apache/logging/log4j/log4j-core/2.25.2/log4j-core-2.25.2.jar',
    ),
  ).toBe('org.apache.logging.log4j:log4j-core:2.25.2')
})

// Regression: a classified jar must keep its FULL classifier. The native netty
// transports use multi-segment classifiers like `linux-x86_64`; truncating to
// the first `-` segment (`linux`) points at a non-existent jar and breaks the
// launch classpath.
test('classpathEntryToLibraryName preserves a multi-segment classifier', () => {
  expect(
    classpathEntryToLibraryName(
      'libraries/io/netty/netty-transport-native-epoll/4.2.7.Final/netty-transport-native-epoll-4.2.7.Final-linux-x86_64.jar',
    ),
  ).toBe('io.netty:netty-transport-native-epoll:4.2.7.Final:linux-x86_64')
})

// A single-segment classifier (e.g. the forge `:api` / `:srg` artifacts).
test('classpathEntryToLibraryName converts a single classifier', () => {
  expect(
    classpathEntryToLibraryName(
      'libraries/net/neoforged/mergetool/2.0.7/mergetool-2.0.7-api.jar',
    ),
  ).toBe('net.neoforged:mergetool:2.0.7:api')
})

// Windows-style separators (the win_args.txt classpath) must parse too.
test('classpathEntryToLibraryName handles backslash separators', () => {
  expect(
    classpathEntryToLibraryName(
      'libraries\\com\\google\\code\\gson\\gson\\2.13.2\\gson-2.13.2.jar',
    ),
  ).toBe('com.google.code.gson:gson:2.13.2')
})

test('isEmptyOrCorruptArchive reads compressed entry payloads', async ({ temp }) => {
  cleanup = join(temp, 'profile-archive')
  await mkdir(cleanup, { recursive: true })
  const archive = join(cleanup, 'processor-output.jar')
  await writeArchive(archive, Buffer.from('forge post-process output '.repeat(4096)))

  expect(await isEmptyOrCorruptArchive(archive)).toBe(false)

  const bytes = await readFile(archive)
  const fileNameLength = bytes.readUInt16LE(26)
  const extraFieldLength = bytes.readUInt16LE(28)
  const dataOffset = 30 + fileNameLength + extraFieldLength
  bytes[dataOffset] = 0xff
  await writeFile(archive, bytes)

  expect(await isEmptyOrCorruptArchive(archive)).toBe(true)
})

test('resolvePostProcessJavaTask isolates each batch processor classpath', async ({ temp }) => {
  cleanup = join(temp, 'profile-batch')
  const minecraft = join(cleanup, 'minecraft')
  const firstJar = join(minecraft, 'libraries', 'example', 'first', '1.0', 'first-1.0.jar')
  const secondJar = join(minecraft, 'libraries', 'example', 'second', '1.0', 'second-1.0.jar')
  const firstDependency = join(minecraft, 'libraries', 'example', 'shared', '1.0', 'shared-1.0.jar')
  const secondDependency = join(minecraft, 'libraries', 'example', 'shared', '2.0', 'shared-2.0.jar')
  await writeProcessorArchive(firstJar, 'example.FirstProcessor')
  await writeProcessorArchive(secondJar, 'example.SecondProcessor')

  const task = await resolvePostProcessJavaTask({
    id: 'forge:test:processors',
    processors: [{
      jar: 'example:first:1.0',
      classpath: ['example:shared:1.0'],
      args: ['--value', 'one'],
    }, {
      jar: 'example:second:1.0',
      classpath: ['example:shared:2.0'],
      args: ['--value', 'two'],
    }],
    minecraft,
    java: 'java',
    javaArgs: ['-Ddirect=true'],
    batch: {
      classpath: 'launcher-only',
      cwd: minecraft,
      javaArgs: ['-Dbatch=true'],
    },
  })

  expect(task.strategies).toHaveLength(2)
  expect(task.strategies[0]).toHaveLength(1)
  expect(task.strategies[0]![0]!.args.slice(0, 5)).toEqual([
    '-Dbatch=true',
    '-cp',
    'launcher-only',
    'MultiJarLauncher',
    expect.any(String),
  ])
  expect(task.strategies[0]![0]!.cwd).toBe(minecraft)

  const invocations = task.strategies[0]![0]!.args.slice(4).map((payload) =>
    Buffer.from(payload, 'base64').toString().split('\0'))
  expect(invocations).toEqual([[
    'example.FirstProcessor',
    '2',
    firstDependency,
    firstJar,
    '--value',
    'one',
  ], [
    'example.SecondProcessor',
    '2',
    secondDependency,
    secondJar,
    '--value',
    'two',
  ]])

  expect(task.strategies[1]!.map((command) => command.args)).toEqual([
    ['-Ddirect=true', '-cp', [firstDependency, firstJar].join(delimiter), 'example.FirstProcessor', '--value', 'one'],
    ['-Ddirect=true', '-cp', [secondDependency, secondJar].join(delimiter), 'example.SecondProcessor', '--value', 'two'],
  ])
})

function processorProfile(args: string[], outputs?: Record<string, string>): InstallProfile {
  return {
    profile: 'neoforge', version: 'neoforge-21.1.255', minecraft: '1.21.1', json: '', path: '', libraries: [],
    processors: [{ jar: 'example:processor:1.0', classpath: [], args, outputs }],
  }
}

test.each([
  '{ROOT}/libraries/',
  '{ROOT}\\libraries\\',
  '{ROOT}/libraries',
  '{ROOT}/libraries/.',
  '{LIBRARY_DIR}',
  '{ROOT}',
  '{ROOT}/extracted/',
])('does not infer a file output for the directory %s', (output) => {
  const [processor] = resolveProcessors('client', processorProfile(['--output', output]), new MinecraftFolder('D:\\.minecraftx'))
  expect(processor.outputs).toEqual({})
})

test.each([
  ['net.minecraftforge:installertools:1.4.1', '--libraries'],
  ['net.minecraftforge:installertools:1.4.1', '--all'],
  ['net.neoforged.installertools:installertools:2.1.2', '--libraries'],
  ['net.neoforged.installertools:installertools:2.1.2', '--all'],
])('recognizes BUNDLER_EXTRACT directory modes without a trailing separator (%s %s)', (jar, mode) => {
  const minecraft = new MinecraftFolder('minecraft')
  const profile = processorProfile([
    '--task', 'BUNDLER_EXTRACT', '--input', '{MINECRAFT_JAR}', '--output', '{ROOT}/extracted.data', mode,
  ])
  profile.processors![0].jar = jar
  const [processor] = resolveProcessors('server', profile, minecraft)
  expect(processor.outputs).toEqual({})
})

test.each(['--output', '--out-jar'])('preserves inferred file outputs from %s and declared checksums', (flag) => {
  const minecraft = new MinecraftFolder('minecraft')
  const profile = processorProfile([flag, '{ROOT}/patched.jar'], { '{ROOT}/patched.jar': "'expected-sha1'" })
  const [processor] = resolveProcessors('client', profile, minecraft)
  expect(processor.outputs).toEqual({ 'minecraft/patched.jar': 'expected-sha1' })
  expect(profile.processors![0].outputs).toEqual({ '{ROOT}/patched.jar': "'expected-sha1'" })
  expect(resolveProcessors('client', processorProfile([flag, '{ROOT}/patched.jar']), minecraft)[0].outputs)
    .toEqual({ 'minecraft/patched.jar': '' })
})

test('retains extensionless file outputs and BUNDLER_EXTRACT single-jar outputs', () => {
  const minecraft = new MinecraftFolder('minecraft')
  expect(resolveProcessors('client', processorProfile(['--output', '{ROOT}/mappings']), minecraft)[0].outputs)
    .toEqual({ 'minecraft/mappings': '' })
  expect(resolveProcessors('server', processorProfile([
    '--task', 'BUNDLER_EXTRACT', '--output', '{ROOT}/server.jar', '--jar-only',
  ]), minecraft)[0].outputs).toEqual({ 'minecraft/server.jar': '' })
})

test('retains an out-jar output when --output is a directory', () => {
  const [processor] = resolveProcessors('client', processorProfile([
    '--output', '{ROOT}/libraries/', '--out-jar', '{ROOT}/patched.jar',
  ]), new MinecraftFolder('minecraft'))
  expect(processor.outputs).toEqual({ 'minecraft/patched.jar': '' })
})

test('never discards an explicitly declared output checksum based on directory inference', () => {
  const [processor] = resolveProcessors('client', processorProfile([
    '--output', '{ROOT}/libraries/',
  ], { '{ROOT}/libraries/': 'declared-checksum' }), new MinecraftFolder('minecraft'))
  expect(processor.outputs).toEqual({ 'minecraft/libraries/': 'declared-checksum' })
})

for (const mode of ['batch', 'fallback', 'failure']) {
  test(`profile workflow protects shared directories and runs extraction (${mode})`, async ({ temp }) => {
    cleanup = join(temp, `profile-directory-${mode}`)
    const minecraft = new MinecraftFolder(cleanup)
    const processorJar = minecraft.getLibraryByPath('example/processor/1.0/processor-1.0.jar')
    await writeProcessorArchive(processorJar, 'example.Processor')
    const sibling = join(minecraft.libraries, 'keep.txt')
    await writeFile(sibling, 'pre-existing library')
    const patched = join(minecraft.root, 'patched.jar')
    await writeArchive(patched, Buffer.from('already valid output'))
    const profile = processorProfile(['--task', 'BUNDLER_EXTRACT', '--output', '{ROOT}/libraries/', '--libraries'])
    profile.processors!.push({
      jar: 'example:processor:1.0', classpath: [], args: ['--out-jar', patched],
    })
    const versionJson = minecraft.getVersionJson(profile.version)
    await mkdir(dirname(versionJson), { recursive: true })
    await writeFile(versionJson, JSON.stringify({
      id: profile.version, type: 'release', mainClass: 'example.Main',
      arguments: { game: [], jvm: [] }, libraries: [],
    }))
    const processors = resolveProcessors('client', profile, minecraft)
    expect(await diagnoseProcessorOutputs(processors)).toEqual([])
    const calls: string[][] = []
    const extracted = join(minecraft.libraries, 'extracted.txt')
    const removed: string[] = []
    const runtime = createNodeInstallRuntime({
      runJava: async (command) => {
        calls.push(command.args)
        if (mode === 'failure') throw new Error('all processors failed')
        if (command.args.includes('MultiJarLauncher')) {
          if (mode === 'fallback') throw new Error('retry with direct processors')
          await writeFile(extracted, 'extracted')
        } else if (command.args.includes('--libraries')) {
          await writeFile(extracted, 'extracted')
        } else {
          await writeArchive(patched, Buffer.from('recreated output'))
        }
      },
    })
    const remove = runtime.remove
    runtime.remove = async (paths) => { removed.push(...paths); await remove(paths) }
    const execution = executeInstallWorkflow(createProfileInstallWorkflow({
      id: 'directory-regression', profile, minecraft, java: 'not-executed', installOptions: {},
      batchLauncher: { path: join(minecraft.root, 'MultiJarLauncher.class'), content: 'mock launcher' },
    }), runtime)

    if (mode === 'failure') {
      await expect(execution).rejects.toThrow('all processors failed')
      expect(calls).toHaveLength(2)
      expect(removed).toContain(patched)
    } else {
      expect(await execution).toBe(profile.version)
      expect(calls).toHaveLength(mode === 'fallback' ? 3 : 1)
      expect(await readFile(extracted, 'utf8')).toBe('extracted')
      expect(await diagnoseProcessorOutputs(processors)).toEqual([])
      expect(await diagnoseProfile(profile, minecraft)).toBe(false)
    }
    expect(removed).not.toContain(`${minecraft.root}/libraries/`)
    expect(await readFile(sibling, 'utf8')).toBe('pre-existing library')
  })
}
