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
import { ZipFile } from 'yauzl'
import { diagnoseFile } from './diagnose'
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
        issues.push(await diagnoseFile({
          role: 'processor',
          file,
          expectedChecksum: checksum.replace(/'/g, ''),
          hint: 'Re-install this installer profile!',
        }))
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

    const neoForgeVersion = serverProfile.arguments?.game.find(
      (v, i, arr) => arr[i - 1] === '--fml.neoForgeVersion',
    )
    if (neoForgeVersion) {
      serverProfile.libraries.push(
        {
          name: `net.neoforged:neoforge:${neoForgeVersion}:universal`,
        },
        {
          name: `net.neoforged:neoforge:${neoForgeVersion}:server`,
        },
      )
    }
    const neoFormVersion = serverProfile.arguments?.game.find(
      (v, i, arr) => arr[i - 1] === '--fml.neoFormVersion',
    )
    if (neoFormVersion) {
      serverProfile.libraries.push(
        {
          name: `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:extra`,
        },
        {
          name: `net.minecraft:server:${installProfile.minecraft}-${neoFormVersion}:srg`,
        },
      )
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

    await writeFile(
      join(minecraftFolder.getVersionRoot(serverProfile.id), 'server.json'),
      JSON.stringify(serverProfile, null, 4),
    )

    const resolvedLibraries = VersionJson.resolveLibraries(serverProfile.libraries)
    await installResolvedLibraries(resolvedLibraries, minecraft, options)
  }
}

function parseArgumentsFromArgsFile(content: string, parentDir: string, serverProfile: Version) {
  const args = content
    .split('\n')
    .map((v) => v.trim().split(' '))
    .flatMap((v) => v)
    .filter((v) => v)
  // find the Main class or -jar
  let mainClass: string = ''
  let jar: string | undefined
  let found = false
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-')) {
      if (args[i] === '-jar') {
        jar = join(parentDir, args[i + 1])
        found = true
        i++
        continue
      }
    } else if (!mainClass) {
      mainClass = args[i]
      found = true
      continue
    }
    if (!found) {
      if (!args[i].startsWith('-D')) {
        serverProfile.arguments!.jvm.push(args[i], args[i + 1])
        i++
      } else {
        serverProfile.arguments!.jvm.push(args[i])
      }
    } else {
      serverProfile.arguments!.game.push(args[i])
    }
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

async function postProcessOne(
  mc: MinecraftFolder,
  proc: PostProcessor,
  options: PostProcessOptions,
) {
  if (await options.handler?.(proc).catch(() => false)) {
    return
  }
  if (proc.outputs && options.diagnose) {
    for (const [file, checksum] of Object.entries(proc.outputs)) {
      const issue = await diagnoseFile(
        {
          role: 'processor',
          file,
          expectedChecksum: checksum.replace(/'/g, ''),
          hint: 'Re-install this installer profile!',
        },
        { signal: options.signal, checksum: options.checksum },
      )
      if (!issue) {
        throw new Error(
          `Post processor output validation failed for file ${file} with expected checksum ${checksum}`,
        )
      }
    }
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
