import { join } from 'path'
import { expect, test } from 'vitest'
import { classpathEntryToLibraryName, parseArgumentsFromArgsFile } from './profile'

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
