import {
  LibraryInfo,
  MinecraftFolder,
  MinecraftLocation,
  Version,
  Version as VersionJson,
} from '@xmcl/core'
import { filterEntries, open, readEntry, walkEntriesGenerator } from '@xmcl/unzip'
import { spawn } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { delimiter, dirname, join, relative, sep } from 'path'
import { ZipFile } from '@xmcl/yauzl'
import { diagnoseFile, Issue } from './diagnose'
import { LibrariesTrackerEvents, LibraryOptions, installResolvedLibraries } from './libraries'
import { convertClasspathToMaven, parseManifest } from './manifest'
import { InstallSideOption } from './minecraft'
import { Tracker, onProgress } from './tracker'
import { SpawnJavaOptions, WithDiagnose, missing, waitProcess } from './utils'

export interface ProfileTrackerEvents {
  postprocess: { count: number }
}

export interface PostProcessor {
  /**
   * The executable jar path
   */
  jar: string
  /**
   * The classpath to run
   */
  classpath: string[]
  args: string[]
  outputs?: { [key: string]: string }
  sides?: Array<'client' | 'server'>
}

export interface InstallProfile {
  spec?: number
  /**
   * The type of this installation, like "forge"
   */
  profile: string
  /**
   * The version of this installation
   */
  version: string
  /**
   * The version json path
   */
  json: string
  /**
   * The maven artifact name: `<org>:<artifact-id>:<version>`
   */
  path: string
  /**
   * The minecraft version
   */
  minecraft: string
  /**
   * The processor shared variables. The key is the name of variable to replace.
   *
   * The value of client/server is the value of the variable.
   */
  data?: { [key: string]: { client: string; server: string } }
  /**
   * The post processor. Which require java to run.
   */
  processors?: Array<PostProcessor>
  /**
   * The required install profile libraries
   */
  libraries: VersionJson.NormalLibrary[]
  /**
   * Legacy format
   */
  versionInfo?: VersionJson
}

export interface PostProcessOptions extends SpawnJavaOptions, WithDiagnose {
  /**
   * Custom handlers to handle the post processor
   */
  handler?: (postProcessor: PostProcessor) => Promise<boolean>

  postprocess?: (
    processor: PostProcessor[],
    minecraftFolder: MinecraftFolder,
    options: PostProcessOptions,
    postprocess: () => Promise<void>,
  ) => Promise<void>

  tracker?: Tracker<ProfileTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>

  signal?: AbortSignal
}

export interface InstallProfileOption
  extends Omit<LibraryOptions, 'tracker'>, InstallSideOption, PostProcessOptions {
  /**
   * New forge (>=1.13) require java to install. Can be a executor or java executable path.
   */
  java?: string
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<LibrariesTrackerEvents & ProfileTrackerEvents>
}

/**
 * Diagnose a install profile status. Check if it processor output correctly processed.
 *
 * This can be used for check if forge correctly installed when minecraft >= 1.13
 * @beta
 *
 * @param installProfile The install profile.
 * @param minecraftLocation The minecraft location
 */
export async function diagnoseProfile(
  installProfile: InstallProfile,
  minecraftLocation: MinecraftLocation,
  side: 'client' | 'server' = 'client',
): Promise<boolean> {
  const mc = MinecraftFolder.from(minecraftLocation)
  const processors: PostProcessor[] = resolveProcessors(side, installProfile, mc)

  const issues = await Promise.all(
    Version.resolveLibraries(installProfile.libraries).map(async (lib) => {
      const libPath = mc.getLibraryByPath(lib.download.path)
      return await diagnoseFile({
        role: 'library',
        file: libPath,
        expectedChecksum: lib.download.sha1,
        hint: 'Problem on install_profile! Please consider to use Installer.installByProfile to fix.',
      })
    }),
  )

  for (const proc of processors) {
    if (proc.outputs) {
      for (const [file, checksum] of Object.entries(proc.outputs)) {
        issues.push(await diagnoseProcessorOutput(file, checksum.replace(/'/g, '')))
      }
    }
  }
  return issues.filter((v) => !!v).length > 0
    ? issues.length === 1 &&
      issues[0]!.file.endsWith('mappings.tsrg') &&
      issues[0]!.type === 'corrupted'
      ? false
      : true
    : false
}

/**
 * Resolve processors in install profile
 */
export function resolveProcessors(
  side: 'client' | 'server',
  installProfile: InstallProfile,
  minecraft: MinecraftFolder,
) {
  function normalizePath(val: string) {
    if (val && val.match(/^\[.+\]$/g)) {
      // match sth like [net.minecraft:client:1.15.2:slim]
      const name = val.substring(1, val.length - 1)
      return minecraft.getLibraryByPath(LibraryInfo.resolve(name).path)
    }
    return val
  }

  const normalizeVariable = (val: string) => {
    if (!val) return val
    // replace "{A}/{B}, which the value of A and B are from varaiables
    // for example, variables = { A: "a", B: "b" }
    // "{A}/{B}" => "a/b"
    // The key variable name can be any alphabet characters and number other special characters
    // Another example, "{A}" => "a"
    return val.replace(/{([A-Za-z0-9_-]+)}/g, (_, key) => variables[key]?.[side] ?? '')
  }

  // store the mapping of {VARIABLE_NAME} -> real path in disk
  const variables: Record<string, { client: string; server: string }> = {
    SIDE: {
      client: 'client',
      server: 'server',
    },
    MINECRAFT_JAR: {
      client: minecraft.getVersionJar(installProfile.minecraft),
      server: minecraft.getVersionJar(installProfile.minecraft, 'server'),
    },
    ROOT: {
      client: minecraft.root,
      server: minecraft.root,
    },
    MINECRAFT_VERSION: {
      client: installProfile.minecraft,
      server: installProfile.minecraft,
    },
    LIBRARY_DIR: {
      client: minecraft.libraries,
      server: minecraft.libraries,
    },
  }
  if (installProfile.data) {
    for (const key in installProfile.data) {
      const { client, server } = installProfile.data[key]
      variables[key] = {
        client: normalizePath(client),
        server: normalizePath(server),
      }
    }
  }

  const resolveOutputs = (proc: PostProcessor, args: string[]) => {
    const original = proc.outputs
      ? Object.entries(proc.outputs)
          .map(([k, v]) => ({ [normalizeVariable(k)]: normalizeVariable(v) }))
          .reduce((a, b) => Object.assign(a, b), {})
      : {}
    for (const [key, val] of Object.entries(original)) {
      original[key] = val.replace(/'/g, '')
    }
    const outputIndex =
      args.indexOf('--output') === -1 ? args.indexOf('--out-jar') : args.indexOf('--output')
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : undefined
    if (outputFile && !original[outputFile]) {
      original[outputFile] = ''
    }
    return original
  }
  const processors = (installProfile.processors || [])
    .map((proc) => {
      const args = proc.args.map(normalizePath).map(normalizeVariable)
      return {
        ...proc,
        args,
        outputs: resolveOutputs(proc, args),
      }
    })
    .filter((proc) => (proc.sides ? proc.sides.indexOf(side) !== -1 : true))
  return processors
}

/**
 * Install by install profile. The install profile usually contains some preprocess should run before installing dependencies.
 *
 * @param installProfile The install profile
 * @param minecraft The minecraft location
 * @param options The options to install
 * @throws {@link PostProcessError}
 */
export async function installByProfile(
  installProfile: InstallProfile,
  minecraft: MinecraftLocation,
  options: InstallProfileOption = {},
): Promise<void> {
  const minecraftFolder = MinecraftFolder.from(minecraft)

  const side = options.side === 'server' ? 'server' : 'client'

  const processor = resolveProcessors(side, installProfile, minecraftFolder)

  const installRequiredLibs = VersionJson.resolveLibraries(installProfile.libraries)

  await installResolvedLibraries(installRequiredLibs, minecraft, options)

  if (options.postprocess) {
    await options.postprocess(processor, minecraftFolder, options, () =>
      postsrocess(processor, minecraftFolder, options),
    )
  } else {
    await postsrocess(processor, minecraftFolder, options)
  }

  if (side === 'client') {
    const versionJson: VersionJson = await readFile(
      minecraftFolder.getVersionJson(installProfile.version),
    )
      .then((b) => b.toString())
      .then(JSON.parse)
    const libraries = VersionJson.resolveLibraries(versionJson.libraries)
    await installResolvedLibraries(libraries, minecraft, options)
  } else {
    const argsText = process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt'

    if (!installProfile.processors) {
      return
    }

    let txtPath: string | undefined
    for (const p of installProfile.processors) {
      txtPath = p.args.find((a) => a.startsWith('{ROOT}') && a.endsWith(argsText))
      if (txtPath) {
        txtPath = txtPath.replace('{ROOT}', minecraftFolder.root)
        if (await missing(txtPath)) {
          throw new Error(`No ${argsText} found in the forge jar`)
        }
        break
      }
    }
    const serverProfile: Version = {
      id: installProfile.version,
      libraries: [],
      type: 'release',
      arguments: {
        game: [],
        jvm: [],
      },
      releaseTime: new Date().toJSON(),
      time: new Date().toJSON(),
      minimumLauncherVersion: 13,
      mainClass: '',
      inheritsFrom: installProfile.minecraft,
    }

    let jar: string | undefined

    if (!txtPath) {
      // legacy
      const info = LibraryInfo.resolve(installProfile.path)
      const libPath = minecraftFolder.getLibraryByPath(info.path)
      jar = libPath
    } else {
      const content = await readFile(txtPath, 'utf-8')
      jar = parseArgumentsFromArgsFile(content, dirname(txtPath), serverProfile)
    }

    if (jar) {
      await parseJar(minecraftFolder, jar, installProfile, serverProfile)
    }

    // NOTE: the NeoForge `:universal` artifact is intentionally NOT added to
    // the server libraries. It is already downloaded via
    // `installProfile.libraries` (so it lives in the library directory), and
    // the official server `-classpath` does NOT list it — FML discovers both
    // `:universal` AND the patched minecraft jar at runtime via
    // `-DlibraryDirectory`. If `:universal` is placed on the server classpath,
    // FML's `RequiredSystemFiles` check picks it as the minecraft system jar,
    // fails to find `net/minecraft/DetectedVersion.class` inside it, and aborts
    // with "The patched Minecraft jar is missing".
    const neoFormVersion = serverProfile.arguments?.game.find(
      (v, i, arr) => arr[i - 1] === '--fml.neoFormVersion',
    )
    if (neoFormVersion) {
      // The neoForm `:extra` (minecraft resources) and `:srg` (SRG-mapped
      // server) jars are PROCESSOR OUTPUTS generated locally during
      // postprocess — they are never published to maven. The legacy MCP
      // pipeline emits them, but modern NeoForge (the unified
      // `PROCESS_MINECRAFT_JAR` task) produces only the patched jar and never
      // these. Reference them only when they actually exist on disk, otherwise
      // the dependency install tries to download them and 404s.
      const candidates = [
        `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:extra`,
        `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:srg`,
      ]
      for (const name of candidates) {
        const libPath = minecraftFolder.getLibraryByPath(LibraryInfo.resolve(name).path)
        if (!(await missing(libPath))) {
          serverProfile.libraries.push({ name })
        }
      }
    }

    const forgeShim = serverProfile.libraries.find(
      (l) => l.name.startsWith('net.minecraftforge:forge') && l.name.endsWith(':shim'),
    )
    if (forgeShim) {
      let zip: ZipFile | undefined
      try {
        zip = await open(minecraftFolder.getLibraryByPath(LibraryInfo.resolve(forgeShim.name).path))
        for await (const entry of walkEntriesGenerator(zip)) {
          if (entry.fileName === 'bootstrap-shim.list') {
            const content = await readEntry(zip, entry).then((e) =>
              e
                .toString()
                .split('\n')
                .map((v) => v.trim())
                .filter((v) => v)
                .map((l) => {
                  const [sha1, name, path] = l.split('\t')
                  return { name }
                }),
            )
            serverProfile.libraries.push(...content)
            break
          }
        }
      } finally {
        zip?.close()
      }
    }

    if (!serverProfile.mainClass) {
      throw new PostProcessNoMainClassError(jar!)
    }

    // Record the full server launch classpath as server.json libraries.
    //
    // The launch rebuilds `-cp` purely from server.json libraries
    // (`Version.parseServer` does NOT inherit the vanilla version), so every jar
    // on the classpath must be listed here or the server dies with
    // `ClassNotFoundException` / `NoClassDefFoundError` (e.g.
    // `net.neoforged.fml.startup.Server` from `loader-*.jar`, or
    // `org.apache.logging.log4j...` from `log4j-core-*.jar`).
    //
    // The authoritative, complete list is the `-classpath` token parsed from
    // win_args.txt — the same one the official `run.sh`/`run.bat` use. Most of
    // these libraries are NOT downloadable from maven: the vanilla libs (log4j,
    // netty, guava, authlib, ...) are EXTRACTED from the minecraft server
    // "bundler" jar by the `PROCESS_MINECRAFT_JAR` processor
    // (`--extract-libraries-to libraries/`), which has already run by this point,
    // so they exist on disk and the dependency install skips them. Where a
    // library is declared in the installer's version.json we reuse that entry
    // (it carries the proper download url for the FancyModLoader stack);
    // otherwise we add a bare name and rely on the on-disk file.
    const clientVersionJson: VersionJson | undefined = await readFile(
      minecraftFolder.getVersionJson(installProfile.version),
    )
      .then((b) => JSON.parse(b.toString()) as VersionJson)
      .catch(() => undefined)
    const versionLibByName = new Map<string, Version['libraries'][number]>()
    for (const lib of clientVersionJson?.libraries ?? []) {
      versionLibByName.set(lib.name, lib)
    }

    const jvmArgs = serverProfile.arguments!.jvm
    const cpIndex = jvmArgs.findIndex((a) => a === '-classpath' || a === '-cp')
    const cpValue = cpIndex !== -1 ? jvmArgs[cpIndex + 1] : undefined
    if (typeof cpValue === 'string') {
      // Drop the verbatim `-classpath <...>` from the jvm args. Its entries are
      // paths relative to the minecraft root, but the server process runs from
      // the `server/` working directory, so they would not resolve. The
      // launcher rebuilds an absolute `-cp` from the libraries below instead.
      jvmArgs.splice(cpIndex, 2)
      const existingNames = new Set(serverProfile.libraries.map((l) => l.name))
      for (const entry of cpValue.split(delimiter)) {
        if (!entry) continue
        const name = classpathEntryToLibraryName(entry)
        if (!name || existingNames.has(name)) continue
        existingNames.add(name)
        serverProfile.libraries.push(versionLibByName.get(name) ?? { name })
      }
    }

    await writeFile(
      join(minecraftFolder.getVersionRoot(serverProfile.id), 'server.json'),
      JSON.stringify(serverProfile, null, 4),
    )

    const resolvedLibraries = VersionJson.resolveLibraries(serverProfile.libraries)
    await installResolvedLibraries(resolvedLibraries, minecraft, options)
  }
}

/**
 * Convert a single `-classpath` entry of a forge/neoforge server args file
 * (a path relative to the minecraft root, e.g.
 * `libraries/io/netty/netty-transport-native-epoll/4.2.7.Final/netty-transport-native-epoll-4.2.7.Final-linux-x86_64.jar`)
 * into its maven coordinate (`io.netty:netty-transport-native-epoll:4.2.7.Final:linux-x86_64`).
 *
 * Unlike {@link convertClasspathToMaven}, the FULL classifier is preserved
 * (that helper keeps only the first `-`-separated segment, which would turn
 * `linux-x86_64` into `linux` and point at a non-existent jar).
 *
 * @returns The maven coordinate, or `undefined` if the path is not a
 * well-formed `libraries/<group>/<artifact>/<version>/<file>.jar` entry.
 */
export function classpathEntryToLibraryName(entry: string): string | undefined {
  const normalized = entry.replace(/^libraries[\\/]/, '')
  const parts = normalized.split(/[\\/]/)
  if (parts.length < 4) return undefined
  const fileName = parts.pop()!.replace(/\.jar$/, '')
  const version = parts.pop()!
  const artifactId = parts.pop()!
  const groupId = parts.join('.')
  if (!groupId || !artifactId || !version || !fileName) return undefined
  const base = `${artifactId}-${version}`
  let name = `${groupId}:${artifactId}:${version}`
  if (fileName.length > base.length && fileName.startsWith(`${base}-`)) {
    name += `:${fileName.slice(base.length + 1)}`
  }
  return name
}

/**
 * JVM options in a forge server args file that consume the following token as
 * their value (e.g. `-p <module-path>`, `--add-opens <spec>`). Every other
 * dashed token (e.g. `-Dkey=value`, `-Xmx2G`, `-XX:+UseCompactObjectHeaders`)
 * is a single, self-contained option.
 */
const JVM_VALUE_OPTIONS = new Set([
  '-p',
  '-cp',
  '-classpath',
  '--class-path',
  '--module-path',
  '--add-opens',
  '--add-exports',
  '--add-modules',
  '--add-reads',
  '--patch-module',
  '--upgrade-module-path',
])

/**
 * Parse a forge server `win_args.txt` / `unix_args.txt` file.
 *
 * The file has the shape `[jvm options...] (-jar <jar> | <main-class>) [game
 * args...]`. The jvm options are collected verbatim, the terminator is either a
 * `-jar <jar>` pair or a bare main-class token, and everything after it is a
 * game argument.
 *
 * @returns The executable jar path (when the file uses `-jar`), otherwise
 * `undefined` (the main class is written onto `serverProfile`).
 */
export function parseArgumentsFromArgsFile(content: string, parentDir: string, serverProfile: Version) {
  const args = content
    .split('\n')
    .map((v) => v.trim().split(' '))
    .flatMap((v) => v)
    .filter((v) => v)
  let mainClass = ''
  let jar: string | undefined
  let i = 0
  // Phase 1: jvm options, terminated by `-jar <jar>` or a bare main-class token.
  for (; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-jar') {
      // The executable jar (e.g. the bootstrap shim) terminates the jvm args.
      jar = join(parentDir, args[i + 1] ?? '')
      i += 2
      break
    }
    if (!arg.startsWith('-')) {
      // A bare token is the main class and terminates the jvm args.
      mainClass = arg
      i += 1
      break
    }
    serverProfile.arguments!.jvm.push(arg)
    if (JVM_VALUE_OPTIONS.has(arg) && args[i + 1] !== undefined) {
      serverProfile.arguments!.jvm.push(args[i + 1])
      i += 1
    }
  }
  // Phase 2: everything remaining is a game/program argument.
  for (; i < args.length; i++) {
    serverProfile.arguments!.game.push(args[i])
  }

  serverProfile.mainClass = mainClass

  return jar
}

async function parseJar(
  minecraftFolder: MinecraftFolder,
  jar: string,
  installProfile: InstallProfile,
  serverVersion: Version,
) {
  let zip: ZipFile | undefined
  try {
    const jsonContent: Version = JSON.parse(
      await readFile(minecraftFolder.getVersionJson(installProfile.version), 'utf-8'),
    )
    zip = await open(jar, { lazyEntries: true, autoClose: false })
    const [entry] = await filterEntries(zip, ['META-INF/MANIFEST.MF'])
    if (entry) {
      const manifestContent = await readEntry(zip, entry).then((b) => b.toString())
      const result = parseManifest(manifestContent)
      serverVersion.mainClass = result.mainClass
      const cp = [
        ...result.classPath,
        relative(minecraftFolder.libraries, jar).replaceAll(sep, '/'),
      ]
      serverVersion.libraries.push(
        ...jsonContent.libraries.filter((l) => !l.name.endsWith(':client')),
      )
      const mavenPaths = convertClasspathToMaven(cp)
      for (const name of mavenPaths) {
        if (serverVersion.libraries.find((l) => l.name === name)) continue
        if (name.startsWith(':')) continue
        serverVersion.libraries.push({ name })
      }
    }
  } catch (e) {
    throw new PostProcessBadJarError(jar, e as any)
  } finally {
    zip?.close()
  }
}

export class PostProcessBadJarError extends Error {
  constructor(
    public jarPath: string,
    public causeBy: Error,
  ) {
    super(`Fail to post process bad jar: ${jarPath}`)
  }

  name = 'PostProcessBadJarError'
}

export class PostProcessNoMainClassError extends Error {
  constructor(public jarPath: string) {
    super(`Fail to post process bad jar without main class: ${jarPath}`)
  }

  name = 'PostProcessNoMainClassError'
}

export class PostProcessFailedError extends Error {
  constructor(
    public jarPath: string,
    public commands: string[],
    message: string,
  ) {
    super(message)
  }

  name = 'PostProcessFailedError'
}

export class PostProcessValidationFailedError extends PostProcessFailedError {
  constructor(
    jarPath: string,
    commands: string[],
    message: string,
    readonly file: string,
    readonly expect: string,
    readonly actual: string,
  ) {
    super(jarPath, commands, message)
  }

  name = 'PostProcessValidationFailedError'
}

async function findMainClass(lib: string) {
  let zip: ZipFile | undefined
  let mainClass: string | undefined
  try {
    zip = await open(lib, { lazyEntries: true })
    for await (const entry of walkEntriesGenerator(zip)) {
      if (entry.fileName === 'META-INF/MANIFEST.MF') {
        const content = await readEntry(zip, entry).then((b) => b.toString())
        mainClass = content
          .split('\n')
          .map((l) => l.split(': '))
          .find((arr) => arr[0] === 'Main-Class')?.[1]
          .trim()
        break
      }
    }
  } catch (e) {
    throw new PostProcessBadJarError(lib, e as any)
  } finally {
    zip?.close()
  }
  if (!mainClass) {
    throw new PostProcessNoMainClassError(lib)
  }
  return mainClass
}

/**
 * Detect whether a jar/zip file is unreadable or contains zero entries.
 *
 * The forge/neoforge `binarypatcher` processor can silently emit a 22-byte
 * empty zip when its lzma input is corrupt. That passes a naive `size > 0`
 * check but leaves the game running against unpatched vanilla classes, which
 * crashes at bootstrap.
 */
async function isEmptyOrCorruptArchive(file: string, signal?: AbortSignal): Promise<boolean> {
  let zip: ZipFile | undefined
  try {
    zip = await open(file, { lazyEntries: true, autoClose: false })
    if (signal?.aborted) return false
    return zip.entryCount <= 0
  } catch {
    return true
  } finally {
    zip?.close()
  }
}

/**
 * Diagnose a single processor output file.
 *
 * In addition to the regular existence/checksum/size check, a jar/zip output
 * that lacks a declared checksum is opened to ensure it is a readable,
 * non-empty archive. Mapping files (`*.tsrg`) are frequently rewritten by
 * later processors so their declared checksum drifts legitimately; only their
 * presence is validated.
 */
async function diagnoseProcessorOutput(
  file: string,
  expectedChecksum: string,
  options?: { signal?: AbortSignal; checksum?: (file: string, algorithm: string) => Promise<string> },
): Promise<Issue | undefined> {
  const isMappings = /mappings\.tsrg$/i.test(file)
  const issue = await diagnoseFile(
    {
      role: 'processor',
      file,
      expectedChecksum: isMappings ? '' : expectedChecksum,
      hint: 'Re-install this installer profile!',
    },
    options,
  )
  if (issue) return issue
  if (!isMappings && expectedChecksum === '' && /\.(jar|zip)$/i.test(file)) {
    if (await isEmptyOrCorruptArchive(file, options?.signal)) {
      return {
        type: 'corrupted',
        role: 'processor',
        file,
        expectedChecksum,
        receivedChecksum: '',
        hint: 'Re-install this installer profile!',
      }
    }
  }
  return undefined
}

/**
 * Diagnose every declared output of the given processors. Returns the list of
 * issues found (empty when all outputs are valid).
 */
export async function diagnoseProcessorOutputs(
  processors: PostProcessor[],
  options?: { signal?: AbortSignal; checksum?: (file: string, algorithm: string) => Promise<string> },
): Promise<Issue[]> {
  const issues: Issue[] = []
  for (const proc of processors) {
    if (!proc.outputs) continue
    for (const [file, expected] of Object.entries(proc.outputs)) {
      const issue = await diagnoseProcessorOutput(file, expected.replace(/'/g, ''), options)
      if (issue) issues.push(issue)
    }
  }
  return issues
}

async function postProcessOne(
  mc: MinecraftFolder,
  proc: PostProcessor,
  options: PostProcessOptions,
) {
  if (await options.handler?.(proc).catch(() => false)) {
    return
  }

  const jarRealPath = mc.getLibraryByPath(LibraryInfo.resolve(proc.jar).path)
  const mainClass = await findMainClass(jarRealPath)
  const cp = [...proc.classpath, proc.jar]
    .map(LibraryInfo.resolve)
    .map((p) => mc.getLibraryByPath(p.path))
    .join(delimiter)
  const cmd = ['-cp', cp, mainClass, ...proc.args]
  try {
    await new Promise((resolve, reject) => {
      const process = (options?.spawn ?? spawn)(options.java ?? 'java', cmd, {
        signal: options.signal,
      })
      waitProcess(process).then(resolve, reject)
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'Error') {
      throw new PostProcessFailedError(proc.jar, [options.java ?? 'java', ...cmd], e.message)
    }
    throw e
  }

  // Validate the processor outputs after running it. A processor that exits
  // with code 0 but writes an empty/corrupt output (e.g. binarypatcher fed a
  // corrupt lzma emitting a 22-byte empty client jar) must fail loudly here
  // instead of being cached as a successful install.
  if (proc.outputs) {
    for (const [file, expected] of Object.entries(proc.outputs)) {
      const expectedChecksum = expected.replace(/'/g, '')
      const issue = await diagnoseProcessorOutput(file, expectedChecksum, {
        signal: options.signal,
        checksum: options.checksum,
      })
      if (issue) {
        throw new PostProcessValidationFailedError(
          proc.jar,
          [options.java ?? 'java', ...cmd],
          `Post processor ${proc.jar} produced ${issue.type} output ${file}` +
            (expectedChecksum
              ? ` (expected sha1 ${expectedChecksum}, got ${issue.receivedChecksum || 'none'})`
              : ' (empty or unreadable archive)'),
          file,
          expectedChecksum,
          issue.receivedChecksum,
        )
      }
    }
  }
}

async function postsrocess(
  processors: PostProcessor[],
  minecraft: MinecraftFolder,
  options: PostProcessOptions,
): Promise<void> {
  const tracker = onProgress(options.tracker, 'postprocess', { count: processors.length })
  tracker.total = processors.length
  for (let i = 0; i < processors.length; i++) {
    const proc = processors[i]
    await postProcessOne(minecraft, proc, options)
    tracker.progress = i
  }
}
