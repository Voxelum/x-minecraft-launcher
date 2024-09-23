import { MinecraftFolder, LaunchOption as ResolvedLaunchOptions, ResolvedVersion, ServerOptions, createMinecraftProcessWatcher, generateArguments, launch, launchServer } from '@xmcl/core'
import { AUTHORITY_DEV, GameProcess, LaunchService as ILaunchService, LauncherProfileState, LaunchException, LaunchOptions, LaunchServiceKey, ReportOperationPayload, ResolvedServerVersion } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs-extra'
import { EOL } from 'os'
import { dirname, join } from 'path'
import { setTimeout } from 'timers/promises'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { EncodingWorker, kEncodingWorker } from '~/encoding'
import { AbstractService, ExposeServiceKey } from '~/service'
import { UserTokenStorage, kUserTokenStorage } from '~/user'
import { isSystemError } from '~/util/error'
import { VersionService } from '~/version'
import { LauncherApp } from '../app/LauncherApp'
import { UTF8 } from '../util/encoding'
import { LaunchMiddleware } from './LaunchMiddleware'

@ExposeServiceKey(LaunchServiceKey)
export class LaunchService extends AbstractService implements ILaunchService {
  private processes: Record<number, GameProcess & { process: ChildProcess }> = {}

  private middlewares: LaunchMiddleware[] = []

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kUserTokenStorage) private userTokenStorage: UserTokenStorage,
    @Inject(kEncodingWorker) private encoder: EncodingWorker,
    @Inject(VersionService) private versionService: VersionService,
  ) {
    super(app)
  }

  registerMiddleware(plugin: LaunchMiddleware) {
    this.middlewares.push(plugin)
  }

  getProcesses(): number[] {
    return (Object.keys(this.processes).map(v => Number(v)))
  }

  #generateServerOptions(options: LaunchOptions, version: ResolvedServerVersion) {
    let javaPath = options.java

    if (javaPath.endsWith('java.exe')) {
      // use javaw.exe
      javaPath = javaPath.substring(0, javaPath.length - 4) + 'w.exe'
    } else if (javaPath.endsWith('java')) {
      // use javaw
      javaPath = javaPath + 'w'
    }

    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.maxMemory
    const maxMemory: number | undefined = options.minMemory
    const jvmArgs = [...version.arguments.jvm]
    if (options.vmOptions) {
      jvmArgs.push(...options.vmOptions)
    }
    const mcArgs = [...version.arguments.game]
    if (options.mcOptions) {
      mcArgs.push(...options.mcOptions)
    }

    const mc = MinecraftFolder.from(options.gameDirectory)
    const classPath = [
      ...version.libraries.filter((lib) => !lib.isNative).map((lib) => mc.getLibraryByPath(lib.download.path)),
      mc.getVersionJar(version.minecraftVersion, 'server'),
    ]

    /**
     * Build launch condition
     */
    const launchOptions: ServerOptions & { version: ResolvedServerVersion } = {
      version,
      javaPath,
      minMemory,
      maxMemory,

      mainClass: version.mainClass,
      serverExectuableJarPath: version.jar ? mc.getLibraryByPath(version.jar) : undefined,
      classPath,

      extraExecOption: {
        detached: true,
        cwd: minecraftFolder.getPath('server'),
      },

      extraJVMArgs: jvmArgs,
      extraMCArgs: mcArgs,
      prependCommand: options.prependCommand,

      nogui: options.nogui,
    }

    return launchOptions
  }

  #generateOptions(options: LaunchOptions, version: ResolvedVersion, accessToken?: string) {
    const user = options.user
    const gameProfile = user.profiles[user.selectedProfile] ?? offline('Steve').selectedProfile
    const javaPath = options.java
    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.minMemory
    const maxMemory: number | undefined = options.maxMemory

    const launcherName = `X Minecraft Launcher (${this.app.version})`
    const javawPath = join(dirname(javaPath), process.platform === 'win32' ? 'javaw.exe' : 'java')
    /**
     * Build launch condition
     */
    const launchOptions: ResolvedLaunchOptions & { version: ResolvedVersion } = {
      gameProfile,
      accessToken,
      properties: {},
      gamePath: minecraftFolder.root,
      resourcePath: this.getPath(),
      javaPath: existsSync(javawPath) ? javawPath : javaPath,
      minMemory,
      maxMemory,
      version,
      server: options.server
        ? {
          ip: options.server.host,
          port: options.server.port,
        }
        : undefined,
      extraExecOption: {
        detached: true,
        cwd: minecraftFolder.root,
      },
      extraJVMArgs: options.vmOptions?.filter(v => !!v),
      extraMCArgs: options.mcOptions?.filter(v => !!v),
      launcherBrand: options?.launcherBrand ?? launcherName,
      launcherName: options?.launcherName ?? launcherName,
      prependCommand: options.prependCommand,
      yggdrasilAgent,
      platform: {
        arch: process.arch,
        name: this.app.platform.os,
        version: this.app.platform.osRelease,
      },
      prechecks: [],
    }

    const getAddress = () => {
      const address = this.app.server.address()
      if (address) {
        if (typeof address === 'string') {
          return `http://localhost${address.substring(address.indexOf(':'))}/yggdrasil`
        }
        return `http://localhost:${address.port}/yggdrasil`
      }
      throw (new Error(`Unexpected state. The OfflineYggdrasilServer does not initialized? Listening: ${this.app.server.listening}`))
    }

    if (launchOptions.yggdrasilAgent) {
      launchOptions.yggdrasilAgent.server = launchOptions.yggdrasilAgent.server === AUTHORITY_DEV
        ? getAddress()
        : launchOptions.yggdrasilAgent.server
      launchOptions.extraJVMArgs?.push(
        '-Dauthlibinjector.legacySkinPolyfill=enabled',
        '-Dauthlibinjector.disableHttpd',
        '-Dauthlibinjector.mojangNamespace=enabled',
        '-Dauthlibinjector.debug',
        '-Dauthlibinjector.mojangAntiFeatures=enabled',
        '-Dauthlibinjector.profileKey=disabled',
        '-Dauthlibinjector.usernameCheck=disabled',
      )
    }

    if (options.server) {
      launchOptions.server = {
        ip: options.server.host,
        port: options.server?.port,
      }
    }

    return launchOptions
  }

  async generateArguments(options: LaunchOptions) {
    try {
      const user = options.user
      const javaPath = options.java

      let version: ResolvedVersion | undefined

      if (options.version) {
        this.log(`Override the version: ${options.version}`)
        try {
          version = await this.versionService.resolveLocalVersion(options.version)
        } catch (e) {
          this.warn(`Cannot use override version: ${options.version}`)
          this.warn(e)
        }
      }

      if (!version) {
        throw new LaunchException({
          type: 'launchNoVersionInstalled',
          options,
        })
      }

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      const accessToken = user ? await this.userTokenStorage.get(user).catch(() => undefined) : undefined
      const _options = this.#generateOptions(options, version, accessToken)
      const args = await generateArguments(_options)

      return args
    } catch (e) {
      if (e instanceof LaunchException) {
        throw e
      }
      throw new LaunchException({ type: 'launchGeneralException', error: { ...(e as any), message: (e as any).message, stack: (e as any).stack } })
    }
  }

  async #track<T>(promise: Promise<T>, name: string, id: string): Promise<T> {
    const start = performance.now()
    this.emit('launch-performance-pre', { id, name })
    try {
      const result = await promise
      this.emit('launch-performance', { id, name, duration: performance.now() - start, success: true })
      return result
    } catch (e) {
      this.emit('launch-performance', { id, name, duration: performance.now() - start, success: false })
      throw e
    }
  }

  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @returns Does this launch request success?
   */
  async launch(options: LaunchOptions) {
    try {
      const user = options.user
      const javaPath = options.java
      const side = options.side ?? 'client'

      let version: ResolvedVersion | ResolvedServerVersion | undefined
      const operationId = options.operationId || randomUUID()

      try {
        if (side === 'client') {
          version = await this.#track(this.versionService.resolveLocalVersion(options.version), 'parse-version', operationId)
        } else {
          version = await this.#track(this.versionService.resolveServerVersion(options.version), 'parse-version', operationId)
        }
      } catch (e) {
        throw new LaunchException({
          type: 'launchNoVersionInstalled',
          options,
        })
      }

      this.log(`Will launch with ${version.id} version.`)

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      let process: ChildProcess
      const context = {}
      let launchOptions: (ResolvedLaunchOptions | ServerOptions)
      if ('inheritances' in version) {
        const accessToken = user ? await this.#track(this.userTokenStorage.get(user).catch(() => undefined), 'get-user-token', operationId) : undefined
        const op = this.#generateOptions(options, version, accessToken)
        for (const plugin of this.middlewares) {
          try {
            await this.#track(plugin.onBeforeLaunch(options, { version, options: op, side: 'client' }, context), plugin.name, operationId)
          } catch (e) {
            this.warn('Fail to run plugin')
            this.error(e as any)
          }
        }

        if (op.server) {
          this.log('Launching a server')
        }

        this.log('Launching client with these option...')
        this.log(JSON.stringify(op, (k, v) => (k === 'accessToken' ? '***' : v), 2))
        process = await this.#track(launch(op), 'spawn-minecraft-process', operationId)
      } else {
        launchOptions = this.#generateServerOptions(options, version)
        for (const plugin of this.middlewares) {
          try {
            await this.#track(plugin.onBeforeLaunch(options, { side: 'server', version, options: launchOptions }, context), plugin.name, operationId)
          } catch (e) {
            this.warn('Fail to run plugin', plugin)
            this.error(e as any)
          }
        }

        this.log('Launching server with these option...')
        this.log(JSON.stringify(launchOptions, (k, v) => (k === 'accessToken' ? '***' : v), 2))
        process = await this.#track(launchServer(launchOptions), 'spawn-minecraft-process', operationId)
      }

      if (typeof process.pid !== 'number') {
        const err = await Promise.race([
          setTimeout(1000),
          new Promise<Error>((resolve) => {
            process.once('error', (e) => {
              if (isSystemError(e) && e.code === 'ENOENT' && e.syscall?.startsWith('spawn')) {
                resolve(new LaunchException({ type: 'launchInvalidJavaPath', javaPath }, javaPath + '; ' + e.path))
              } else {
                if (e.name === 'Error') {
                  Object.assign(e, {
                    name: 'LaunchSpawnProcessError',
                  })
                }
                resolve(e)
              }
            })
          }),
        ])
        if (err) {
          this.error(err)
          throw err
        }
        throw new LaunchException({ type: 'launchSpawnProcessFailed' })
      }
      const processData = {
        pid: process.pid,
        options,
        process,
        side,
        ready: false,
      }
      this.processes[process.pid] = processData

      const watcher = createMinecraftProcessWatcher(process)
      const errorLogs = [] as string[]
      const startTime = Date.now()
      this.emit('minecraft-start', {
        pid: process.pid,
        operationId,
        minecraft: version.minecraftVersion,
        ...options,
        startTime,
      })

      let encoding = undefined as string | undefined
      const processError = async (buf: Buffer) => {
        encoding = encoding || await this.encoder.guessEncodingByBuffer(buf).catch(e => UTF8) || encoding
        const result = await this.encoder.decode(buf, encoding!)
        this.emit('minecraft-stderr', { pid: process.pid, stderr: result })
        const lines = result.split(EOL)
        errorLogs.push(...lines)
        this.warn(result)
      }
      const processLog = async (buf: any) => {
        encoding = encoding || await this.encoder.guessEncodingByBuffer(buf).catch(e => UTF8) || encoding
        const result = await this.encoder.decode(buf, encoding!)
        this.emit('minecraft-stdout', { pid: process.pid, stdout: result })
      }

      const errPromises = [] as Promise<any>[]
      process.stderr?.on('data', async (buf: any) => {
        errPromises.push(processError(buf))
      })
      process.stdout?.on('data', (s) => {
        processLog(s).catch(this.error)
      })

      watcher.on('error', (err) => {
        this.emit('error', new LaunchException({ type: 'launchGeneralException', error: err }))
      }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
        const endTime = Date.now()
        const playTime = endTime - startTime

        if (crashReport && code === 0) {
          code = 1
        }

        this.log(`Minecraft exit: ${code}, signal: ${signal}`)
        if (crashReportLocation) {
          crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4)
        }
        Promise.all(errPromises).catch((e) => { this.error(e) }).finally(() => {
          for (const plugin of this.middlewares) {
            try {
              plugin.onAfterLaunch?.({ code, signal, crashReport, crashReportLocation }, { version, options: launchOptions, side } as any, context)
            } catch (e) {
              this.warn('Fail to run plugin')
              this.error(e as any)
            }
          }
          this.emit('minecraft-exit', {
            pid: process.pid,
            ...options,
            code,
            operationId,
            signal,
            crashReport,
            duration: playTime,
            crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
            errorLog: errorLogs.join('\n'),
          })
        })
        delete this.processes[processData.pid]
      }).on('minecraft-window-ready', () => {
        processData.ready = true
        this.emit('minecraft-window-ready', { pid: processData.pid, ...options })
      })
      process.unref()

      return process.pid
    } catch (e) {
      this.error(e as Error)
      if (e instanceof LaunchException) {
        throw e
      }
      throw new LaunchException({ type: 'launchGeneralException', error: { ...(e as any), message: (e as any).message, stack: (e as any).stack } }, (e as any).message, { cause: e })
    }
  }

  async kill(pid: number) {
    const process = this.processes[pid]
    delete this.processes[pid]
    if (process) {
      if (process.side === 'client') {
        process.process.kill()
      } else {
        if (process.ready) {
          process.process.stdin?.write('/stop\n')
        } else {
          process.process.kill()
        }
      }
    }
  }

  async getGameProcess(pid: number): Promise<GameProcess | undefined> {
    const proc = this.processes[pid]
    if (!proc) return undefined
    return {
      pid: proc.pid,
      side: proc.side,
      ready: proc.ready,
      options: proc.options,
    }
  }

  async getGameProcesses(): Promise<GameProcess[]> {
    return Object.values(this.processes).map(v => ({
      pid: v.pid,
      side: v.side,
      ready: v.ready,
      options: v.options,
    }))
  }

  isParked(instancePath: string): boolean {
    for (const p of Object.values(this.processes)) {
      if (p.options.gameDirectory === instancePath) {
        return true
      }
    }
    return false
  }

  async reportOperation(payload: ReportOperationPayload): Promise<void> {
    if ('duration' in payload) {
      this.emit('launch-performance', {
        id: payload.operationId,
        name: payload.name,
        duration: payload.duration,
        success: payload.success,
      })
    } else {
      this.emit('launch-performance-pre', {
        id: payload.operationId,
        name: payload.name,
      })
    }
  }
}
