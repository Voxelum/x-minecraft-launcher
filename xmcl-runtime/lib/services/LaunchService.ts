import { createMinecraftProcessWatcher, diagnoseJar, diagnoseLibraries, launch, LaunchOption as ResolvedLaunchOptions, LaunchPrecheck, MinecraftFolder, ResolvedVersion, Version, generateArguments } from '@xmcl/core'
import { AUTHORITY_DEV, GameProcess, LaunchService as ILaunchService, LaunchException, LaunchOptions, LaunchServiceKey } from '@xmcl/runtime-api'
import { ChildProcess } from 'child_process'
import { EOL } from 'os'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { EncodingWorker, kEncodingWorker } from '../entities/encodingWorker'
import { JavaValidation } from '../entities/java'
import { kUserTokenStorage, UserTokenStorage } from '../entities/userTokenStore'
import { UTF8 } from '../util/encoding'
import { Inject } from '../util/objectRegistry'
import { InstallService } from './InstallService'
import { JavaService } from './JavaService'
import { AbstractService, ExposeServiceKey } from './Service'
import { kGameDataPath, PathResolver } from '../entities/gameDataPath'

export interface LaunchMiddleware {
  onBeforeLaunch(input: LaunchOptions, output: ResolvedLaunchOptions, context: Record<string, any>): Promise<void>
  onAfterLaunch?(result: {
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
  }, output: ResolvedLaunchOptions, context: Record<string, any>): void
}

@ExposeServiceKey(LaunchServiceKey)
export class LaunchService extends AbstractService implements ILaunchService {
  private processes: Record<number, GameProcess & { process: ChildProcess }> = {}

  private plugins: LaunchMiddleware[] = []

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstallService) private installService: InstallService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kUserTokenStorage) private userTokenStorage: UserTokenStorage,
    @Inject(kEncodingWorker) private encoder: EncodingWorker,
  ) {
    super(app)
  }

  registerMiddleware(plugin: LaunchMiddleware) {
    this.plugins.push(plugin)
  }

  getProcesses(): number[] {
    return (Object.keys(this.processes).map(v => Number(v)))
  }

  #generateOptions(options: LaunchOptions, version: ResolvedVersion, accessToken?: string) {
    const user = options.user
    const gameProfile = user.profiles[user.selectedProfile]
    const javaPath = options.java
    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.maxMemory
    const maxMemory: number | undefined = options.minMemory
    const prechecks = [LaunchPrecheck.checkNatives, LaunchPrecheck.linkAssets]

    /**
     * Build launch condition
     */
    const launchOptions: ResolvedLaunchOptions = {
      gameProfile,
      accessToken,
      properties: {},
      gamePath: minecraftFolder.root,
      resourcePath: this.getPath(),
      javaPath,
      minMemory,
      maxMemory,
      version,
      extraExecOption: {
        detached: true,
        cwd: minecraftFolder.root,
      },
      extraJVMArgs: options.vmOptions?.filter(v => !!v),
      extraMCArgs: options.mcOptions?.filter(v => !!v),
      launcherBrand: options?.launcherBrand ?? '',
      launcherName: options?.launcherName ?? 'XMCL',
      yggdrasilAgent,
      prechecks,
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
          version = await Version.parse(this.getPath(), options.version)
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

  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @returns Does this launch request success?
   */
  async launch(options: LaunchOptions) {
    try {
      const user = options.user
      const javaPath = options.java

      let version: ResolvedVersion | undefined

      if (options.version) {
        this.log(`Override the version: ${options.version}`)
        try {
          version = await Version.parse(this.getPath(), options.version)
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

      if (!options?.skipAssetsCheck) {
        const resolvedVersion = version
        const resourceFolder = new MinecraftFolder(this.getPath())
        await Promise.all([
          diagnoseJar(resolvedVersion, resourceFolder).then((issue) => {
            if (issue) {
              return this.installService.installMinecraftJar(resolvedVersion)
            }
          }),
          diagnoseLibraries(version, resourceFolder).then(async (libs) => {
            if (libs.length > 0) {
              await this.installService.installLibraries(libs.map(l => l.library))
            }
          }),
        ])
      }

      this.log(`Will launch with ${version.id} version.`)

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      const accessToken = user ? await this.userTokenStorage.get(user).catch(() => undefined) : undefined
      const launchOptions = this.#generateOptions(options, version, accessToken)
      const context = {}
      for (const plugin of this.plugins) {
        try {
          await plugin.onBeforeLaunch(options, launchOptions, context)
        } catch (e) {
          this.warn('Fail to run plugin')
          this.error(e as any)
        }
      }

      try {
        const result = await this.javaService.validateJavaPath(javaPath)
        if (result === JavaValidation.NotExisted) {
          throw new LaunchException({ type: 'launchInvalidJavaPath', javaPath })
        }
        if (result === JavaValidation.NoPermission) {
          throw new LaunchException({ type: 'launchJavaNoPermission', javaPath })
        }
      } catch (e) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath }, 'Cannot launch without a valid java')
      }

      if (launchOptions.server) {
        this.log('Launching a server')
      }

      this.log('Launching with these option...')
      this.log(JSON.stringify(launchOptions, (k, v) => (k === 'accessToken' ? '***' : v), 2))

      // Launch
      const process = await launch(launchOptions)
      const processData = {
        pid: process.pid!,
        options,
        process,
        ready: false,
      }
      this.processes[process.pid!] = processData

      const watcher = createMinecraftProcessWatcher(process)
      const errorLogs = [] as string[]
      const startTime = Date.now()
      this.emit('minecraft-start', {
        pid: process.pid,
        minecraft: version.minecraftVersion,
        ...options,
        startTime,
      })

      const processError = async (buf: Buffer) => {
        const encoding = await this.encoder.guessEncodingByBuffer(buf).catch(e => { })
        const result = await this.encoder.decode(buf, encoding || UTF8)
        this.emit('minecraft-stderr', { pid: process.pid, stderr: result })
        const lines = result.split(EOL)
        errorLogs.push(...lines)
        this.warn(result)
      }
      const processLog = async (buf: any) => {
        const encoding = await this.encoder.guessEncodingByBuffer(buf).catch(e => undefined)
        const result = await this.encoder.decode(buf, encoding || UTF8)
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

        this.log(`Minecraft exit: ${code}, signal: ${signal}`)
        if (crashReportLocation) {
          crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4)
        }
        Promise.all(errPromises).catch((e) => { this.error(e) }).finally(() => {
          for (const plugin of this.plugins) {
            try {
              plugin.onAfterLaunch?.({ code, signal, crashReport, crashReportLocation }, launchOptions, context)
            } catch (e) {
              this.warn('Fail to run plugin')
              this.error(e as any)
            }
          }
          this.emit('minecraft-exit', {
            pid: process.pid,
            ...options,
            code,
            signal,
            crashReport,
            duration: playTime,
            crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
            errorLog: errorLogs.join('\n'),
          })
        })
        delete this.processes[process.pid!]
      }).on('minecraft-window-ready', () => {
        processData.ready = true
        this.emit('minecraft-window-ready', { pid: process.pid, ...options })
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
      process.process.kill()
    }
  }

  async getGameProcess(pid: number): Promise<GameProcess | undefined> {
    const proc = this.processes[pid]
    if (!proc) return undefined
    return {
      pid: proc.pid,
      ready: proc.ready,
      options: proc.options,
    }
  }

  async getGameProcesses(): Promise<GameProcess[]> {
    return Object.values(this.processes).map(v => ({
      pid: v.pid,
      ready: v.ready,
      options: v.options,
    }))
  }
}
