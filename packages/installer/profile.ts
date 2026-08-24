import {
  LibraryInfo,
  MinecraftFolder,
  MinecraftLocation,
  ResolvedLibrary,
  Version,
  Version as VersionJson,
} from '@xmcl/core'
import { open, readEntry, walkEntriesGenerator } from '@xmcl/unzip'
import { stat } from 'fs/promises'
import { delimiter, join } from 'path'
import { ZipFile } from '@xmcl/yauzl'
import { diagnoseFile, Issue } from './diagnose'
import type { InstallJavaTask, InstallOutput, JavaCommand } from './installManifest'
import { LibrariesTrackerEvents, LibraryOptions } from './libraries'
import { InstallSideOption } from './minecraft'
import { Tracker } from './tracker'
import { SpawnJavaOptions, WithDiagnose } from './utils'

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

export const POST_PROCESS_BATCH_PROTOCOL = 'isolated-classloader-v1'

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

  executePlan?: (
    processors: PostProcessor[],
    libraries: ResolvedLibrary[],
    minecraftFolder: MinecraftFolder,
    options: PostProcessOptions,
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
  options?: { signal?: AbortSignal; checksum?: (file: string, algorithm: string) => Promise<string>; timestamp?: number },
): Promise<boolean> {
  const mc = MinecraftFolder.from(minecraftLocation)
  const processors: PostProcessor[] = resolveProcessors(side, installProfile, mc)

  const issues = await Promise.all(
    Version.resolveLibraries(installProfile.libraries).map(async (lib) => {
      const libPath = mc.getLibraryByPath(lib.download.path)
      return await diagnoseFile(
        {
          role: 'library',
          file: libPath,
          expectedChecksum: lib.download.sha1,
          hint: 'Reinstall this installer profile.',
        },
        options,
      )
    }),
  )

  for (const proc of processors) {
    if (proc.outputs) {
      for (const [file, checksum] of Object.entries(proc.outputs)) {
        issues.push(await diagnoseProcessorOutput(file, checksum.replace(/'/g, ''), options))
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

export async function resolvePostProcessJavaTask(options: {
  id: string
  processors: PostProcessor[]
  minecraft: MinecraftLocation
  java: string
  batch?: {
    classpath: string
    cwd?: string
    javaArgs?: string[]
  }
  javaArgs?: string[]
  dependsOn?: string[]
  metadata?: Record<string, string | number | boolean>
}): Promise<InstallJavaTask> {
  const minecraft = MinecraftFolder.from(options.minecraft)
  const commands: JavaCommand[] = []
  const batchInvocations: string[] = []
  for (const processor of options.processors) {
    const jar = minecraft.getLibraryByPath(LibraryInfo.resolve(processor.jar).path)
    const classpathEntries = [...processor.classpath, processor.jar]
      .map(LibraryInfo.resolve)
      .map((library) => minecraft.getLibraryByPath(library.path))
    const mainClass = await findMainClass(jar)
    commands.push({
      executable: options.java,
      args: [
        ...(options.javaArgs ?? []),
        '-cp',
        classpathEntries.join(delimiter),
        mainClass,
        ...processor.args,
      ],
    })
    batchInvocations.push(Buffer.from([
      mainClass,
      String(classpathEntries.length),
      ...classpathEntries,
      ...processor.args,
    ].join('\0')).toString('base64'))
  }

  const outputs = new Map<string, InstallOutput>()
  for (const processor of options.processors) {
    for (const [path, rawChecksum] of Object.entries(processor.outputs ?? {})) {
      const mappings = /mappings\.tsrg$/i.test(path)
      const checksum = mappings ? '' : rawChecksum.replace(/'/g, '')
      outputs.set(path, {
        path,
        checksum: checksum ? { algorithm: 'sha1', value: checksum } : undefined,
        validator: !mappings && /\.(jar|zip)$/i.test(path) ? 'zip' : 'file',
      })
    }
  }

  return {
    id: options.id,
    type: 'java',
    strategies: [
      ...(options.batch ? [[{
        executable: options.java,
        args: [
          ...(options.batch.javaArgs ?? []),
          '-cp',
          options.batch.classpath,
          'MultiJarLauncher',
          ...batchInvocations,
        ],
        cwd: options.batch.cwd,
      }]] : []),
      commands,
    ],
    outputs: [...outputs.values()],
    dependsOn: options.dependsOn,
    metadata: {
      telemetryKind: 'postprocess',
      protocolVersion: options.batch ? POST_PROCESS_BATCH_PROTOCOL : 'direct',
      processorCount: options.processors.length,
      ...options.metadata,
    },
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
  readonly processor: string
  readonly exitCode?: number | null
  readonly processSignal?: string | null
  readonly processorOutput?: string

  constructor(
    readonly jarPath: string,
    readonly commands: string[],
    message: string,
    options?: {
      exitCode?: number | null
      signal?: string | null
      output?: string
    },
  ) {
    super(message)
    this.processor = jarPath
    this.exitCode = options?.exitCode
    this.processSignal = options?.signal
    this.processorOutput = options?.output
    Object.defineProperties(this, {
      jarPath: { enumerable: false },
      commands: { enumerable: false },
    })
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
export async function isEmptyOrCorruptArchive(file: string, signal?: AbortSignal): Promise<boolean> {
  let zip: ZipFile | undefined
  try {
    zip = await open(file, { lazyEntries: true, autoClose: false })
    let entries = 0
    for await (const entry of walkEntriesGenerator(zip)) {
      if (signal?.aborted) return false
      entries += 1
      if (!entry.fileName.endsWith('/')) {
        await readEntry(zip, entry)
      }
    }
    return entries <= 0
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
  options?: { signal?: AbortSignal; checksum?: (file: string, algorithm: string) => Promise<string>; timestamp?: number },
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
    if (options?.timestamp !== undefined) {
      const fileStat = await stat(file).catch(() => undefined)
      if (fileStat && fileStat.mtimeMs <= options.timestamp) return undefined
    }
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
  options?: { signal?: AbortSignal; checksum?: (file: string, algorithm: string) => Promise<string>; timestamp?: number },
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
