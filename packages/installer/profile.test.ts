import { createWriteStream } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { delimiter, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { afterEach, expect, test } from 'vitest'
import { ZipFile } from 'yazl'
import { classpathEntryToLibraryName, isEmptyOrCorruptArchive, parseArgumentsFromArgsFile, resolvePostProcessJavaTask } from './profile'

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
