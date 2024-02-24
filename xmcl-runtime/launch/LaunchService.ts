import { MinecraftFolder, LaunchOption as ResolvedLaunchOptions, ResolvedVersion, createMinecraftProcessWatcher, generateArguments, launch } from '@xmcl/core'
import { AUTHORITY_DEV, GameProcess, LaunchService as ILaunchService, LaunchException, LaunchOptions, LaunchServiceKey, ReportOperationPayload } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { EOL } from 'os'
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

  #generateOptions(options: LaunchOptions, version: ResolvedVersion, accessToken?: string) {
    const user = options.user
    const gameProfile = user.profiles[user.selectedProfile] ?? offline('Steve').selectedProfile
    const javaPath = options.java
    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.minMemory
    const maxMemory: number | undefined = options.maxMemory

    const launcherName = `X Minecraft Launcher (${this.app.version})`
    /**
     * Build launch condition
     */
    const launchOptions: ResolvedLaunchOptions & { version: ResolvedVersion } = {
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
      launcherBrand: options?.launcherBrand ?? launcherName,
      launcherName: options?.launcherName ?? launcherName,
      yggdrasilAgent,
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

      let version: ResolvedVersion | undefined
      const operationId = options.operationId || randomUUID()

      if (options.version) {
        this.log(`Override the version: ${options.version}`)
        try {
          version = await this.#track(this.versionService.resolveLocalVersion(options.version), 'parse-version', operationId)
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

      this.log(`Will launch with ${version.id} version.`)

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      const accessToken = user ? await this.#track(this.userTokenStorage.get(user).catch(() => undefined), 'get-user-token', operationId) : undefined
      const launchOptions = this.#generateOptions(options, version, accessToken)
      const context = {}
      for (const plugin of this.middlewares) {
        try {
          await this.#track(plugin.onBeforeLaunch(options, launchOptions, context), plugin.name, operationId)
        } catch (e) {
          this.warn('Fail to run plugin')
          this.error(e as any)
        }
      }

      if (launchOptions.server) {
        this.log('Launching a server')
      }

      this.log('Launching with these option...')
      this.log(JSON.stringify(launchOptions, (k, v) => (k === 'accessToken' ? '***' : v), 2))

      const commonLibs = version.libraries.filter(lib => !lib.isNative)
      for (const lib of commonLibs) {
        if (!lib.download.path) {
          (lib.download as any).path = lib.path
          if (!lib.download.path) {
            throw new LaunchException({ type: 'launchBadVersion', version: version.id }, JSON.stringify(lib))
          }
        }
      }

      // Launch
      const process = await this.#track(launch(launchOptions), 'spawn-minecraft-process', operationId)
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
          for (const plugin of this.middlewares) {
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
