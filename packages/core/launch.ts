import { open, openEntryReadStream, walkEntriesGenerator } from '@xmcl/unzip'
import { ChildProcess, SpawnOptions, spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { createWriteStream, existsSync } from 'fs'
import { link, mkdir, readFile, writeFile } from 'fs/promises'
import { EOL } from 'os'
import { basename, delimiter, dirname, isAbsolute, join, resolve, sep } from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { MinecraftFolder } from './folder'
import { Platform, getPlatform } from './platform'
import { checksum, isNotNull, validateSha1 } from './utils'
import { ResolvedLibrary, ResolvedVersion, Version } from './version'

function format(template: string, args: any) {
  return template.replace(/\$\{(.*?)}/g, (key) => {
    const value = args[key.substring(2).substring(0, key.length - 3)]
    return value || key
  })
}

export const DEFAULT_EXTRA_JVM_ARGS = Object.freeze([
  '-Xmx2G',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+UseG1GC',
  '-XX:G1NewSizePercent=20',
  '-XX:G1ReservePercent=20',
  '-XX:MaxGCPauseMillis=50',
  '-XX:G1HeapRegionSize=32M',
])
export interface EnabledFeatures {
  [featureName: string]: object | boolean | undefined
  // eslint-disable-next-line camelcase
  has_custom_resolution?: { resolution_width: string; resolution_height: string }
  // eslint-disable-next-line camelcase
  is_demo_user?: boolean
}

/**
 * General launch option, used to generate launch arguments.
 * @see {@link generateArguments}
 * @see {@link launch}
 */
export interface LaunchOption {
  /**
   * User selected game profile. For game display name &
   */
  gameProfile?: {
    name: string
    id: string
  }
  accessToken?: string
  userType?: 'mojang' | 'legacy'
  properties?: object

  launcherName?: string
  launcherBrand?: string
  /**
   * Overwrite the version name of the current version.
   * If this is absent, it will use version name from resolved version.
   */
  versionName?: string
  /**
   * Overwrite the version type of the current version.
   * If this is absent, it will use version type from resolved version.
   *
   * Some people use this to show fantastic message on the welcome screen.
   */
  versionType?: string
  /**
   * The full path of launched game icon
   * Currently, this only supported on MacOS
   */
  gameIcon?: string
  /**
   * The launched game name
   * Currently, this only supported on MacOS
   */
  gameName?: string
  /**
   * The path of parent directory of saves/logs/configs/mods/resourcepacks
   */
  gamePath: string
  /**
   * The path of parent directory of assets/libraries
   */
  resourcePath?: string
  /**
   * The java executable file path. (Not the java home directory!)
   */
  javaPath: string
  /**
   * Min memory, this will add a jvm flag -Xms to the command result
   */
  minMemory?: number
  /**
   * Min memory, this will add a jvm flag -Xmx to the command result
   */
  maxMemory?: number
  /**
   * The version of launched Minecraft. Can be either resolved version or version string
   */
  version: string | ResolvedVersion
  /**
   * Directly launch to a server
   */
  server?: { ip: string; port?: number }
  /**
   * Directly launch to a server using quickPlayMultiplayer option (for newer Minecraft versions)
   * This will use --quickPlayMultiplayer instead of --server and --port
   */
  quickPlayMultiplayer?: string
  /**
   * Resolution. This will add --height & --width or --fullscreen to the java arguments
   */
  resolution?: { width?: number; height?: number; fullscreen?: boolean }
  /**
   * Extra jvm options. This will append after to generated options.
   * If this is empty, the `DEFAULT_EXTRA_JVM_ARGS` will be used.
   */
  extraJVMArgs?: string[]
  /**
   * Extra program arguments. This will append after to generated options.
   */
  extraMCArgs?: string[]
  /**
   * Prepend command before java command.
   */
  prependCommand?: string | string[]
  /**
   * Assign the spawn options to the process.
   *
   * If you try to set `{ shell: true }`, you might want to make all argument rounded with "".
   * The `launch` function will do it for you, but if you want to spawn process by yourself, remember to do that.
   */
  extraExecOption?: SpawnOptions

  /**
   * Native directory. It's .minecraft/versions/<version>/<version>-natives by default.
   * You can replace this by your self.
   */
  nativeRoot?: string
  /**
   * Enable features. Not really in used...
   */
  features?: EnabledFeatures
  /**
   * Support yushi's yggdrasil agent https://github.com/to2mbn/authlib-injector/wiki
   */
  yggdrasilAgent?: {
    /**
     * The jar file path of the authlib-injector
     */
    jar: string
    /**
     * The auth server host
     */
    server: string
    /**
     * The prefetched base64
     */
    prefetched?: string
  }
  /**
   * Add `-Dfml.ignoreInvalidMinecraftCertificates=true` to jvm argument
   */
  ignoreInvalidMinecraftCertificates?: boolean
  /**
   * Add `-Dfml.ignorePatchDiscrepancies=true` to jvm argument
   */
  ignorePatchDiscrepancies?: boolean
  /**
   * Add extra classpaths
   */
  extraClassPaths?: string[]
  /**
   * The platform of this launch will run. By default, it will fetch the current machine info if this is absent.
   */
  platform?: Platform
  /**
   * Use hash assets index. This will use the assets index hash as the assets index name.
   */
  useHashAssetsIndex?: boolean
  /**
   * The launcher precheck functions. These will run before it run.
   *
   * This property is only used for `launch` function. The `generateArguments` function won't use this!
   * @see {@link launch}
   * @see {@link generateArguments}
   */
  prechecks?: LaunchPrecheck[]
  /**
   * Demo mode.
   */
  demo?: boolean
  /**
   * The spawn process function. Used for spawn the java process at the end.
   *
   * By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
   */
  spawn?: (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) => ChildProcess
}

/**
 * The function to check the game status before the game launched. Will be used in `launch` function.
 * @see {@link launch}
 */
export interface LaunchPrecheck {
  (resourcePath: MinecraftFolder, version: ResolvedVersion, option: LaunchOption): Promise<void>
}

/**
 * Thrown when the version jar is corrupted. This interface only used in `LaunchPrecheck.checkVersion`
 * @see {@link LaunchPrecheck.checkVersion}
 */
export interface CorruptedVersionJarError {
  error: 'CorruptedVersionJar'
  version: string
}
/**
 * Thrown when the libraries jar is corrupted. This interface only used in `LaunchPrecheck.checkLibraries`
 * @see {@link LaunchPrecheck.checkLibraries}
 */
export interface MissingLibrariesError {
  error: 'MissingLibraries'
  libraries: ResolvedLibrary[]
  version: ResolvedVersion
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LaunchPrecheck {
  /**
   * The default launch precheck. It will check version jar, libraries and natives.
   */
  export const DEFAULT_PRECHECKS: readonly LaunchPrecheck[] = Object.freeze([
    checkVersion,
    checkLibraries,
    checkNatives,
    linkAssets,
  ])

  /**
   * @deprecated
   */
  export const Default = LaunchPrecheck.DEFAULT_PRECHECKS

  /**
   * Link assets to the assets/virtual/legacy.
   */
  export async function linkAssets(
    resource: MinecraftFolder,
    version: ResolvedVersion,
    option: LaunchOption,
  ) {
    if (version.assets !== 'legacy' && !version.assets.startsWith('pre-')) {
      return
    }
    const assetsIndexPath = resource.getAssetsIndex(version.assets)
    const buf = await readFile(assetsIndexPath)
    const assetsIndex: { objects: Record<string, { hash: string; size: number }> } = JSON.parse(
      buf.toString(),
    )
    const virtualPath = resource.getPath('assets/virtual/' + version.assets)
    await mkdir(virtualPath, { recursive: true }).catch(() => {})

    const dirs = Object.keys(assetsIndex.objects)
      .map((path) => dirname(join(virtualPath, path)))
      .reduce((a, b) => a.add(b), new Set<string>())
    await Promise.all([...dirs].map((dir) => mkdir(dir, { recursive: true })))

    for (const [path, { hash }] of Object.entries(assetsIndex.objects)) {
      const assetPath = resource.getAsset(hash)
      const targetPath = join(virtualPath, path)
      await link(assetPath, targetPath).catch((e) => {
        if (e.code !== 'EEXIST') {
          throw e
        }
      })
    }
  }

  /**
   * Quick check if Minecraft version jar is corrupted
   * @throws {@link CorruptedVersionJarError}
   */
  export async function checkVersion(
    resource: MinecraftFolder,
    version: ResolvedVersion,
    option: LaunchOption,
  ) {
    const jarPath = resource.getVersionJar(version.minecraftVersion)
    if (version.downloads.client?.sha1) {
      if (!(await validateSha1(jarPath, version.downloads.client.sha1))) {
        throw Object.assign(
          new Error(
            `Corrupted Version jar ${jarPath}. Either the file not reachable or the file sha1 not matched!`,
          ),
          {
            error: 'CorruptedVersionJar',
            version: version.minecraftVersion,
          } as CorruptedVersionJarError,
        )
      }
    }
  }
  /**
   * Quick check if there are missed libraries.
   * @throws {@link MissingLibrariesError}
   */
  export async function checkLibraries(
    resource: MinecraftFolder,
    version: ResolvedVersion,
    option: LaunchOption,
  ) {
    const validMask = await Promise.all(
      version.libraries.map((lib) =>
        validateSha1(resource.getLibraryByPath(lib.download.path), lib.download.sha1),
      ),
    )
    const corruptedLibs = version.libraries.filter((_, index) => !validMask[index])

    if (corruptedLibs.length > 0) {
      throw Object.assign(
        new Error(
          `Missing ${corruptedLibs.length} libraries! Either the file not reachable or the file sha1 not matched!`,
        ),
        {
          error: 'MissingLibraries',
          libraries: corruptedLibs,
          version,
        } as MissingLibrariesError,
      )
    }
  }
  /**
   * Ensure the native are correctly extracted in place.
   *
   * It will check native root located in {@link LaunchOption.nativeRoot} if it's presented.
   * Or, it will use the `<version-id>-native` under version folder as native root to check.
   *
   * This will automatically extract native if there is not native extracted.
   *
   * @param resource The minecraft directory to extract native
   * @param option If the native root presented here, it will use the root here.
   */
  export async function checkNatives(
    resource: MinecraftFolder,
    version: ResolvedVersion,
    option: LaunchOption,
  ) {
    const native: string = option.nativeRoot || resource.getNativesRoot(version.id)
    await mkdir(native, { recursive: true }).catch((e) => {
      if (e.code !== 'EEXIST') {
        throw e
      }
    })
    const natives = version.libraries.filter(
      (lib) => lib.isNative,
    )
    const checksumFile = join(native, '.json')
    const includedLibs = natives.map((n) => n.name).sort()

    interface ChecksumFile {
      entries: CheckEntry[]
      libraries: string[]
    }
    interface CheckEntry {
      file: string
      sha1: string
      name: string
    }

    const checksumFileObject: ChecksumFile = await readFile(checksumFile, 'utf-8')
      .then(JSON.parse)
      .catch((e) => undefined)

    let shaEntries: CheckEntry[] | undefined
    if (checksumFileObject && checksumFileObject.libraries) {
      // only if the lib not change
      // consider the case of os changed or java changed
      if (checksumFileObject.libraries.sort().every((v, i) => v === includedLibs[i])) {
        shaEntries = checksumFileObject.entries
      }
    }

    const extractedNatives: CheckEntry[] = []
    async function extractJar(n: ResolvedLibrary | undefined) {
      if (!n) {
        return
      }
      const excluded: string[] = n.extractExclude || []

      const platform = option.platform || getPlatform()
      const containsExcludes = (p: string) => excluded.filter((s) => p.startsWith(s)).length === 0
      const notInMetaInf = (p: string) => p.indexOf('META-INF/') === -1
      const notSha1AndNotGit = (p: string) => !(p.endsWith('.sha1') || p.endsWith('.git'))
      const isSatisfyPlaform = (p: string) => {
        if (p.indexOf('/') === -1) {
          return true
        }
        const [os, arch] = p.split('/')
        const platformArch = arch === 'ia32' ? 'x86' : arch
        return os === platform.name && platformArch === platform.arch
      }

      if (!n.download.path) {
        throw Object.assign(
          new TypeError(`Library ${n.name}(${version.id}) has no download path!`),
          { library: n },
        )
      }

      const from = resource.getLibraryByPath(n.download.path)
      const promises: Promise<void>[] = []
      const zip = await open(from, { lazyEntries: true, autoClose: false })
      for await (const entry of walkEntriesGenerator(zip)) {
        if (
          containsExcludes(entry.fileName) &&
          notInMetaInf(entry.fileName) &&
          notSha1AndNotGit(entry.fileName) &&
          !entry.fileName.endsWith('/') &&
          isSatisfyPlaform(entry.fileName)
        ) {
          const fileName = basename(entry.fileName)
          const dest = join(native, fileName)
          if (fileName.indexOf('/') !== -1) {
            await mkdir(dirname(dest), {
              recursive: true,
            }).catch((e) => {})
          }
          extractedNatives.push({ file: fileName, name: n.name, sha1: '' })
          promises.push(
            promisify(pipeline)(await openEntryReadStream(zip, entry), createWriteStream(dest)),
          )
        }
      }
      await Promise.all(promises)
    }
    if (shaEntries) {
      const validEntries: { [name: string]: boolean } = {}
      for (const entry of shaEntries) {
        if (typeof entry.file !== 'string') {
          continue
        }
        const file = join(native, entry.file)
        const valid = await validateSha1(file, entry.sha1, true)
        if (valid) {
          validEntries[entry.name] = true
        }
      }
      const missingNatives = natives.filter((n) => !validEntries[n.name])
      if (missingNatives.length !== 0) {
        const result = await Promise.allSettled(missingNatives.map(extractJar))
        const errors = result
          .map((r) => (r.status === 'rejected' ? (r.reason as Error) : undefined))
          .filter(isNotNull)
        if (errors.length === 0) {
          return
        }
        if (errors.length === 1) {
          throw errors[0]
        }
        throw new AggregateError(errors, 'Some natives failed to extract')
      }
    } else {
      const result = await Promise.allSettled(natives.map(extractJar))
      const entries = await Promise.all(
        extractedNatives.map(async (n) => ({
          ...n,
          sha1: await checksum(join(native, n.file), 'sha1'),
        })),
      )
      const fileContent = JSON.stringify({
        entries,
        libraries: includedLibs,
      })
      await writeFile(checksumFile, fileContent)

      const errors = result
        .map((r) => (r.status === 'rejected' ? (r.reason as Error) : undefined))
        .filter(isNotNull)
      if (errors.length === 0) {
        return
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      throw new AggregateError(errors, 'Some natives failed to extract')
    }
  }
}

export interface BaseServerOptions {
  /**
   * Java executable.
   */
  javaPath: string
  /**
   * No gui for the server launch
   */
  nogui?: boolean
  minMemory?: number
  maxMemory?: number
  extraJVMArgs?: string[]
  extraMCArgs?: string[]
  extraExecOption?: SpawnOptions

  prependCommand?: string | string[]

  /**
   * The spawn process function. Used for spawn the java process at the end. By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
   */
  spawn?: (command: string, args?: ReadonlyArray<string>, options?: SpawnOptions) => ChildProcess
}

/**
 * This is the case you provide the server jar execution path.
 */
export interface ServerOptions extends BaseServerOptions {
  /**
   * The minecraft server exectuable jar file.
   *
   * This is the case like you are launching forge server.
   */
  serverExectuableJarPath?: string

  mainClass?: string

  classPath?: string[]
}

export async function launchServer(options: ServerOptions) {
  const args = generateArgumentsServer(options)
  const spawnOption = { env: process.env, ...options.extraExecOption }
  return (options.spawn ?? spawn)(args[0], args.slice(1), spawnOption)
}

/**
 * The Minecraft process watcher. You can inspect Minecraft launch state by this.
 *
 * Generally, there are several cases after you call `launch` and get `ChildProcess` object
 *
 * 1. child process fire an error, no real process start.
 * 2. child process started, but game crash (code is not 0).
 * 3. cihld process started, game normally exit (code is 0).
 */
// @ts-ignore
export interface MinecraftProcessWatcher extends EventEmitter {
  /**
   * Fire when the process DOESN'T start at all, like "java not found".
   *
   * The minecraft-kill or minecraft-exit will NOT fire after this fired.
   */
  on(event: 'error', listener: (error: any) => void): this
  /**
   * Fire after Minecraft process exit.
   */
  on(
    event: 'minecraft-exit',
    listener: (event: {
      /**
       * The code of the process exit. This is the nodejs child process "exit" event arg.
       */
      code: number
      /**
       * The signal of the process exit. This is the nodejs child process "exit" event arg.
       */
      signal: string
      /**
       * The crash report content
       */
      crashReport: string
      /**
       * The location of the crash report
       */
      crashReportLocation: string
    }) => void,
  ): this
  /**
   * Fire around the time when Minecraft window appeared in screen.
   *
   * Since the Minecraft window will take time to init, this event fire when it capture some keywords from stdout.
   */
  on(event: 'minecraft-window-ready', listener: () => void): this
}

/**
 * Create a process watcher for a minecraft process.
 *
 * It will watch the stdout and the error event of the process to detect error and minecraft state.
 * @param process The Minecraft process
 * @param emitter The event emitter which will emit usefule event
 */
export function createMinecraftProcessWatcher(
  process: ChildProcess,
  emitter: EventEmitter = new EventEmitter(),
): MinecraftProcessWatcher {
  let crashReport = ''
  let crashReportLocation = ''
  let waitForReady = true
  process.on('error', (e) => {
    emitter.emit('error', e)
  })
  process.on('exit', (code, signal) => {
    emitter.emit('minecraft-exit', {
      code,
      signal,
      crashReport,
      crashReportLocation,
    })
  })
  process.stdout?.on('data', (s) => {
    const string = s.toString()
    if (string.indexOf('---- Minecraft Crash Report ----') !== -1) {
      crashReport = string
    } else if (string.indexOf('Crash report saved to:') !== -1) {
      crashReportLocation = string.substring(
        string.indexOf('Crash report saved to:') + 'Crash report saved to: #@!@# '.length,
      )
      crashReportLocation = crashReportLocation.replace(EOL, '').trim()
    } else if (string.indexOf('Crash report saved to ') !== -1) {
      crashReportLocation = string.substring(
        string.indexOf('Crash report saved to ') + 'Crash report saved to '.length,
      )
      crashReportLocation = crashReportLocation.replace(EOL, '').trim()
    } else if (
      waitForReady &&
      (string.indexOf('Missing metadata in pack') !== -1 ||
        string.indexOf('Registering resource reload listener') !== -1 ||
        string.indexOf('Reloading ResourceManager') !== -1 ||
        string.indexOf('LWJGL Version: ') !== -1 ||
        string.indexOf('OpenAL initialized.') !== -1)
    ) {
      waitForReady = false
      emitter.emit('minecraft-window-ready')
    } else if (waitForReady && string.indexOf(' Preparing level ') !== -1) {
      waitForReady = false
      emitter.emit('minecraft-window-ready')
    } else if (string.indexOf('Failed to start the minecraft server') !== -1) {
      crashReport = string
    }
  })
  return emitter
}

/**
 * Launch the minecraft as a child process. This function use spawn to create child process. To use an alternative way, see function generateArguments.
 *
 * By default, it will use the `LauncherPrecheck.Default` to pre-check:
 * - It will also check if the runtime libs are completed, and will extract native libs if needed.
 * - It might throw exception when the version jar is missing/checksum not matched.
 * - It might throw if the libraries/natives are missing.
 *
 * If you DON'T want such precheck, and you want to change it. You can assign the `prechecks` property in launch
 *
 * ```ts
 * launch({ ...otherOptions, prechecks: yourPrechecks });
 * ```
 *
 * @param options The detail options for this launching.
 * @see [ChildProcess](https://nodejs.org/api/child_process.html)
 * @see [spawn](https://nodejs.org/api/spawn.html)
 * @see {@link generateArguments}
 * @see {@link createMinecraftProcessWatcher}
 * @throws {@link CorruptedVersionJarError}
 * @throws {@link MissingLibrariesError}
 */
export async function launch(options: LaunchOption): Promise<ChildProcess> {
  const gamePath = !isAbsolute(options.gamePath) ? resolve(options.gamePath) : options.gamePath
  const resourcePath = options.resourcePath || gamePath
  const version =
    typeof options.version === 'string'
      ? await Version.parse(resourcePath, options.version)
      : options.version

  let args = await generateArguments({ ...options, version, gamePath, resourcePath })

  const minecraftFolder = MinecraftFolder.from(resourcePath)
  const prechecks = options.prechecks || LaunchPrecheck.DEFAULT_PRECHECKS
  await Promise.all(prechecks.map((f) => f(minecraftFolder, version, options)))
  const spawnOption = { cwd: options.gamePath, ...options.extraExecOption }

  if (options.extraExecOption?.shell) {
    args = args.map((a) => `"${a}"`)
  }
  // fix the ENOTFOUND if cwd does not existed.
  if (!existsSync(gamePath)) {
    await mkdir(gamePath)
  }

  return (options.spawn ?? spawn)(args[0], args.slice(1), spawnOption)
}

function unshiftPrependCommand(cmd: string[], prependCommand?: string[] | string) {
  if (prependCommand) {
    if (typeof prependCommand === 'string') {
      if (prependCommand.trim().length > 0) {
        cmd.push(prependCommand.trim())
      }
    } else {
      const prepended = prependCommand.filter((c) => c.trim().length > 0)
      cmd.unshift(...prepended)
    }
  }
}

/**
 * Generate the argument for server
 */
export function generateArgumentsServer(
  options: ServerOptions,
  _delimiter: string = delimiter,
  _sep: string = sep,
) {
  const {
    javaPath,
    minMemory,
    maxMemory,
    extraJVMArgs = [],
    extraMCArgs = [],
    extraExecOption = {},
  } = options
  const cmd = [javaPath]
  if (minMemory) {
    cmd.push(`-Xms${minMemory}M`)
  }
  if (maxMemory) {
    cmd.push(`-Xmx${maxMemory}M`)
  }
  cmd.push(...extraJVMArgs)

  if (options.classPath && options.classPath.length > 0) {
    cmd.push('-cp', options.classPath.map((v) => v.replaceAll(sep, _sep)).join(_delimiter))
  }

  if (options.serverExectuableJarPath) {
    cmd.push('-jar', options.serverExectuableJarPath.replaceAll(sep, _sep))
  } else if (options.mainClass) {
    cmd.push(options.mainClass)
  }

  cmd.push(...extraMCArgs)

  if (options.nogui) {
    cmd.push('nogui')
  }

  unshiftPrependCommand(cmd, options.prependCommand)

  return cmd
}

/**
 * Generate the arguments array by options. This function is useful if you want to launch the process by yourself.
 *
 * This function will **NOT** check if the runtime libs are completed, and **WONT'T** check or extract native libs.
 *
 * If you want to ensure native. Please see {@link LaunchPrecheck.checkNatives}.
 *
 * @param options The launch options.
 * @throws TypeError if options does not fully fulfill the requirement
 */
export async function generateArguments(options: LaunchOption) {
  if (!options.version) {
    throw new TypeError('Version cannot be null!')
  }
  if (!options.demo) {
    options.demo = false
  }

  const currentPlatform = options.platform ?? getPlatform()
  const gamePath = !isAbsolute(options.gamePath) ? resolve(options.gamePath) : options.gamePath
  const resourcePath = options.resourcePath || gamePath
  const version =
    typeof options.version === 'string'
      ? await Version.parse(resourcePath, options.version)
      : options.version
  const mc = MinecraftFolder.from(resourcePath)
  const cmd: string[] = []

  const { id = randomUUID().replace(/-/g, ''), name = 'Steve' } = options.gameProfile || {}
  const accessToken = options.accessToken || randomUUID().replace(/-/g, '')
  const properties = options.properties || {}
  const userType = options.userType || 'msa'
  const features = options.features || {}
  const jvmArguments = normalizeArguments(version.arguments.jvm, currentPlatform, features)
  const gameArguments = normalizeArguments(version.arguments.game, currentPlatform, features)
  const featureValues = Object.values(features)
    .filter((f) => typeof f === 'object')
    .reduce((a: any, b: any) => ({ ...a, ...b }), {})
  const launcherName = options.launcherName || 'Launcher'
  const launcherBrand = options.launcherBrand || '0.0.1'
  const nativeRoot = options.nativeRoot || mc.getNativesRoot(version.id)

  let gameIcon = options.gameIcon
  if (!gameIcon) {
    const index = mc.getAssetsIndex(version.assets)
    const indexContent = await readFile(index, { encoding: 'utf-8' }).then(
      (b) => JSON.parse(b.toString()),
      () => ({}),
    )
    if ('icons/minecraft.icns' in indexContent) {
      gameIcon = mc.getAsset(indexContent['icons/minecraft.icns'].hash)
    } else if ('minecraft/icons/minecraft.icns' in indexContent) {
      gameIcon = mc.getAsset(indexContent['minecraft/icons/minecraft.icns'].hash)
    } else {
      gameIcon = ''
    }
  }
  const gameName = options.gameName || 'Minecraft'

  cmd.push(options.javaPath)

  if (currentPlatform.name === 'osx') {
    cmd.push(`-Xdock:name=${gameName}`)
    if (gameIcon) {
      cmd.push(`-Xdock:icon=${gameIcon}`)
    }
  }

  if (options.minMemory) {
    cmd.push(`-Xms${options.minMemory}M`)
  }
  if (options.maxMemory) {
    cmd.push(`-Xmx${options.maxMemory}M`)
  }

  if (options.ignoreInvalidMinecraftCertificates) {
    cmd.push('-Dfml.ignoreInvalidMinecraftCertificates=true')
  }
  if (options.ignorePatchDiscrepancies) {
    cmd.push('-Dfml.ignorePatchDiscrepancies=true')
  }

  if (options.yggdrasilAgent) {
    cmd.push(`-javaagent:${options.yggdrasilAgent.jar}=${options.yggdrasilAgent.server}`)
    cmd.push('-Dauthlibinjector.side=client')
    if (options.yggdrasilAgent.prefetched) {
      cmd.push(`-Dauthlibinjector.yggdrasil.prefetched=${options.yggdrasilAgent.prefetched}`)
    }
  }

  const jvmOptions = {
    natives_directory: nativeRoot.replaceAll('\\', '/'),
    launcher_name: launcherName,
    launcher_version: launcherBrand,
    game_directory: gamePath.replaceAll('\\', '/'),
    classpath: [
      ...version.libraries
        .filter((lib) => !lib.isNative)
        .map((lib) => mc.getLibraryByPath(lib.download.path)),
      mc.getVersionJar(version.minecraftVersion),
      ...(options.extraClassPaths || []),
    ]
      .map((c) => c.replaceAll('\\', '/'))
      .join(delimiter),
    library_directory: mc.getPath('libraries').replaceAll('\\', '/'),
    classpath_separator: delimiter,
    version_name: version.minecraftVersion,
    ...featureValues,
  }

  if (version.logging && version.logging.client) {
    const client = version.logging.client
    const argument = client.argument
    const filePath = mc.getLogConfig(client.file.id)
    if (existsSync(filePath)) {
      // eslint-disable-next-line no-template-curly-in-string
      jvmArguments.push(argument.replace('${path}', filePath))
    }
  }

  cmd.push(...jvmArguments.map((arg) => format(arg, jvmOptions)))

  if (!cmd.some((v) => v.startsWith('-DlibraryDirectory'))) {
    cmd.push('-DlibraryDirectory=' + mc.getPath('libraries').replaceAll('\\', '/'))
  }

  // add extra jvm args
  if (options.extraJVMArgs instanceof Array) {
    if (options.extraJVMArgs.some((v) => typeof v !== 'string')) {
      throw new TypeError('Require extraJVMArgs be all string!')
    }
    cmd.push(...options.extraJVMArgs)
  } else {
    // if options object already has `maxMemory` property, exclude the "-Xmx2G" option from the default extra jvm args
    if (options.maxMemory) {
      cmd.push(...DEFAULT_EXTRA_JVM_ARGS.filter((v) => v !== '-Xmx2G'))
    } else {
      cmd.push(...DEFAULT_EXTRA_JVM_ARGS)
    }
  }

  cmd.push(version.mainClass)
  const assetsDir = join(resourcePath, 'assets')
  const resolution = options.resolution
  const versionName = options.versionName || version.id
  const versionType = options.versionType || version.type
  const mcOptions = {
    version_name: versionName,
    version_type: versionType,
    assets_root: assetsDir.replaceAll('\\', '/'),
    game_assets: join(assetsDir, 'virtual', version.assets).replaceAll('\\', '/'),
    assets_index_name: options.useHashAssetsIndex
      ? (version.assetIndex?.sha1 ?? version.assets)
      : version.assets,
    auth_session: accessToken,
    game_directory: gamePath.replaceAll('\\', '/'),
    auth_player_name: name,
    auth_uuid: id,
    auth_access_token: accessToken,
    user_properties: JSON.stringify(properties),
    user_type: userType,
    resolution_width: -1,
    resolution_height: -1,
    ...featureValues,
  }

  if (resolution) {
    mcOptions.resolution_width = resolution.width
    mcOptions.resolution_height = resolution.height
  }

  cmd.push(...gameArguments.map((arg) => format(arg, mcOptions)))

  if (options.extraMCArgs) {
    cmd.push(...options.extraMCArgs)
  }
  if (options.quickPlayMultiplayer) {
    cmd.push('--quickPlayMultiplayer', options.quickPlayMultiplayer)
  }
  if (options.server) {
    cmd.push('--server', options.server.ip)
    if (options.server.port) {
      cmd.push('--port', options.server.port.toString())
    }
  }
  if (options.resolution && !cmd.find((a) => a === '--width')) {
    if (options.resolution.fullscreen) {
      cmd.push('--fullscreen')
    } else {
      if (options.resolution.height) {
        cmd.push('--height', options.resolution.height.toString())
      }
      if (options.resolution.width) {
        cmd.push('--width', options.resolution.width.toString())
      }
    }
  }

  if (options.demo) {
    cmd.push('--demo')
  }

  unshiftPrependCommand(cmd, options.prependCommand)

  return cmd
}

/**
 * Truely normalize the launch argument.
 */
function normalizeArguments(
  args: Version.LaunchArgument[],
  platform: Platform,
  features: EnabledFeatures,
): string[] {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg
      }
      if (!Version.checkAllowed(arg.rules || [], platform, Object.keys(features))) {
        return ''
      }
      return arg.value
    })
    .reduce<string[]>((result, cur) => {
      if (cur instanceof Array) {
        result.push(...cur)
      } else if (cur) {
        result.push(cur)
      }
      return result
    }, [])
}

/**
 * Create a quickPlayMultiplayer string from server IP and optional port
 * @param ip The server IP address
 * @param port The server port (optional, defaults to 25565 if not specified)
 * @returns A formatted string for quickPlayMultiplayer option
 */
export function createQuickPlayMultiplayer(ip: string, port?: number): string {
  return port ? `${ip}:${port}` : ip
}
