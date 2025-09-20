import { MinecraftFolder, type LaunchOption as ResolvedLaunchOptions, type ResolvedVersion, type ServerOptions, type ResolvedServerVersion, createMinecraftProcessWatcher, generateArguments, generateArgumentsServer, launch, launchServer } from '@xmcl/core'
import { AUTHORITY_DEV, type CreateLaunchShortcutOptions, type GameProcess, type LaunchService as ILaunchService, LaunchException, type LaunchOptions, LaunchServiceKey, type ReportOperationPayload } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { ChildProcess, spawn } from 'child_process'
import createDesktopShortcut, { type ShortcutOptions } from 'create-desktop-shortcuts'
import vbTextContent from 'create-desktop-shortcuts/src/windows.vbs'
import { randomUUID } from 'crypto'
import { constants, existsSync } from 'fs'
import { access, writeFile } from 'fs-extra'
import { EOL } from 'os'
import { basename, dirname, join } from 'path'
import { createICO } from 'png2icons'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { Inject, LauncherAppKey, type PathResolver, kGameDataPath } from '~/app'
import { type EncodingWorker, kEncodingWorker } from '~/encoding'
import { AbstractService, ExposeServiceKey } from '~/service'
import { type UserTokenStorage, kUserTokenStorage } from '~/user'
import { kYggdrasilSeriveRegistry } from '~/user/YggdrasilSeriveRegistry'
import { normalizeCommandLine } from './utils/cmd'
import { isSystemError } from '@xmcl/utils'
import { VersionService } from '~/version'
import { LauncherApp } from '../app/LauncherApp'
import { UTF8 } from '../util/encoding'
import type { LaunchMiddleware } from './LaunchMiddleware'
import { ensureDir } from '@xmcl/installer/utils'

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

  async #isValidAndExeucatable(javaPath: string) {
    return await access(javaPath, constants.X_OK).then(() => true).catch(() => false)
  }

  /**
   * Execute pre-launch command
   * @param command The command to execute
   * @param cwd The working directory
   * @param operationId The operation id
   */
  async #execPreCommand(command: string, cwd: string): Promise<void> {
    if (!command.trim()) return;

    this.log(`Executing pre-launch command: ${command}`);
    try {
      const process = spawn(command, {
        shell: true,
        cwd,
        stdio: 'pipe',
      });

      return await new Promise<void>((resolve, reject) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        process.stdout?.on('data', (data) => {
          stdoutChunks.push(Buffer.from(data));
          this.log(`[Pre-Launch CMD] ${data.toString('utf-8').trim()}`);
        });

        process.stderr?.on('data', (data) => {
          stderrChunks.push(Buffer.from(data));
          this.warn(`[Pre-Launch CMD Error] ${data.toString('utf-8').trim()}`);
        });

        process.on('error', (err) => {
          this.warn(`Pre-launch command failed: ${err.message}`);
          reject(new LaunchException({ type: 'launchPreExecuteCommandFailed', command, error: err.message }, 'Failed to execute pre-command'));
        });

        process.on('exit', (code) => {
          if (code === 0) {
            this.log('Pre-launch command executed successfully');
            resolve();
          } else {
            const stderr = Buffer.concat(stderrChunks).toString('utf-8');
            const error = `Pre-launch command exited with code ${code}. Error: ${stderr}`;
            reject(new LaunchException({ type: 'launchPreExecuteCommandFailed', command, error }, 'Pre-launch command failed'));
          }
        });
      });
    } catch (e) {
      this.warn(`Failed to spawn pre-launch command: ${e}`);
      throw new LaunchException({ type: 'launchPreExecuteCommandFailed', command, error: (e as Error).message }, 'Failed to execute pre-command');
    }
  }

  async generateServerOptions(options: LaunchOptions, version: ResolvedServerVersion) {
    let javaPath = options.java

    if (javaPath.endsWith('java.exe')) {
      // use javaw.exe if javaw exists and has permission to execute
      const javawPath = javaPath.substring(0, javaPath.length - 4) + 'w.exe'
      if (await this.#isValidAndExeucatable(javawPath)) {
        javaPath = javawPath
      }
    } else if (javaPath.endsWith('java')) {
      const javawPath = javaPath + 'w'
      if (await this.#isValidAndExeucatable(javawPath)) {
        javaPath = javawPath
      }
    }

    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.minMemory
    const maxMemory: number | undefined = options.maxMemory
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
    const prepend = normalizeCommandLine(options.prependCommand)

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
        shell: prepend && prepend.length > 0,
        detached: true,
        cwd: minecraftFolder.getPath('server'),
        env: { ...process.env, ...options.env },
      },

      extraJVMArgs: jvmArgs,
      extraMCArgs: mcArgs,
      prependCommand: prepend,

      nogui: options.nogui,
    }

    return launchOptions
  }

  async #generateOptions(options: LaunchOptions, version: ResolvedVersion, accessToken?: string) {
    const user = options.user
    const demo = !user.id && !user.selectedProfile && !user.username
    const gameProfile = user.profiles[user.selectedProfile] ?? offline('Steve').selectedProfile
    const javaPath = options.java
    const yggdrasilAgent = options.yggdrasilAgent

    const minecraftFolder = new MinecraftFolder(options.gameDirectory)

    const minMemory: number | undefined = options.minMemory
    const maxMemory: number | undefined = options.maxMemory

    const launcherName = `X Minecraft Launcher (${this.app.version})`
    const javawPath = join(dirname(javaPath), process.platform === 'win32' ? 'javaw.exe' : 'javaw')
    const validJavaPath = await this.#isValidAndExeucatable(javawPath) ? javawPath : javaPath
    const prepend = normalizeCommandLine(options.prependCommand)
    /**
     * Build launch condition
     */
    const launchOptions: ResolvedLaunchOptions & { version: ResolvedVersion } = {
      gameProfile,
      accessToken,
      properties: {},
      gamePath: minecraftFolder.root,
      resourcePath: this.getPath(),
      javaPath: validJavaPath,
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
        shell: prepend && prepend.length > 0,
        detached: true,
        cwd: minecraftFolder.root,
        env: { ...process.env, ...options.env },
      },
      extraJVMArgs: options.vmOptions?.filter(v => !!v),
      extraMCArgs: options.mcOptions?.filter(v => !!v),
      launcherBrand: options?.launcherBrand ?? launcherName,
      launcherName: options?.launcherName ?? launcherName,
      prependCommand: prepend,
      yggdrasilAgent,
      resolution: options.resolution,
      useHashAssetsIndex: true,
      platform: {
        arch: process.arch,
        name: this.app.platform.os,
        version: this.app.platform.osRelease,
      },
      demo,
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
        '-Dauthlibinjector.debug',
      )

      const reg = await this.app.registry.get(kYggdrasilSeriveRegistry)
      const auth = reg.getYggdrasilServices().find(y => y.url === user.authority)
      if (auth?.authlibInjector) {
        const injectedBase64 = Buffer.from(JSON.stringify(auth.authlibInjector)).toString('base64')
        launchOptions.extraJVMArgs?.push(`-Dauthlibinjector.yggdrasil.prefetched=${injectedBase64}`)
      }
    }

    if (options.server) {
      launchOptions.server = {
        ip: options.server.host,
        port: options.server?.port,
      }
      launchOptions.quickPlayMultiplayer = `${options.server.host}${options.server.port ? `:${options.server.port}` : ''}`
    }

    return launchOptions
  }

  async generateArguments(options: LaunchOptions) {
    try {
      if (options.side === 'client') {
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
        const _options = await this.#generateOptions(options, version, accessToken)
        const args = await generateArguments(_options)

        return args
      } else {
        const version = await this.versionService.resolveServerVersion(options.version)
        const launchOptions = await this.generateServerOptions(options, version)
        const args = generateArgumentsServer(launchOptions)
        return args
      }
    } catch (e) {
      if (e instanceof LaunchException) {
        throw e
      }
      if (e instanceof Error) {
        if (!e.stack) {
          e.stack = new Error().stack
        }
        if (e.name === 'Error') {
          Object.assign(e, {
            name: 'LaunchGeneralError',
          })
        }
      }
      throw e
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

      // Execute pre-launch command if specified
      if (options.preExecuteCommand) {
        this.log(`Executing pre-execute command: ${options.preExecuteCommand}`)
        await this.#track(this.#execPreCommand(options.preExecuteCommand, options.gameDirectory), 'pre-execute-command', operationId)
      }

      let process: ChildProcess
      const context = {}
      let launchOptions: (ResolvedLaunchOptions | ServerOptions)
      if ('inheritances' in version) {
        const accessToken = user ? await this.#track(this.userTokenStorage.get(user).catch(() => undefined), 'get-user-token', operationId) : undefined
        const op = await this.#generateOptions(options, version, accessToken)
        launchOptions = op
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
        try {
          process = await this.#track(launch(op), 'spawn-minecraft-process', operationId)
        } catch (e) {
          if (isSystemError(e) && e.code === 'EPERM') {
            throw new LaunchException({ type: 'launchJavaNoPermission', javaPath: op.javaPath }, 'Fail to spawn process')
          }
          throw e
        }
      } else {
        launchOptions = await this.generateServerOptions(options, version)
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
      const stdLogs = [] as string[]
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
        if (!encoding) {
          encoding = await this.encoder.guessEncodingByBuffer(buf).catch(e => UTF8) || UTF8
        }
        const result = await this.encoder.decode(buf, encoding)
        this.emit('minecraft-stderr', { pid: process.pid, stderr: result })
        const lines = result.split(EOL)
        errorLogs.push(...lines)
        this.warn(result)
      }
      const processLog = async (buf: any) => {
        if (!encoding) {
          encoding = await this.encoder.guessEncodingByBuffer(buf).catch(e => UTF8) || UTF8
        }
        const result = await this.encoder.decode(buf, encoding)
        this.emit('minecraft-stdout', { pid: process.pid, stdout: result })
        if (!processData.ready) {
          stdLogs.push(...result.split(EOL))
        }
      }

      const errPromises = [] as Promise<any>[]
      process.stderr?.on('data', async (buf: any) => {
        errPromises.push(processError(buf))
      })
      process.stdout?.on('data', (s) => {
        const p = processLog(s).catch(this.error)
        if (!processData.ready) {
          errPromises.push(p)
        }
      })

      watcher.on('error', (err) => {
        this.emit('error', err)
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
          const errorLog = errorLogs.join('\n');
          for (const plugin of this.middlewares) {
            try {
              plugin.onAfterLaunch?.({ code, signal, crashReport, crashReportLocation, errorLog }, options, { version, options: launchOptions, side } as any, context)
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
            errorLog,
            stdLog: stdLogs.join('\n'),
          })
        })
        delete this.processes[processData.pid]
      }).on('minecraft-window-ready', () => {
        processData.ready = true
        stdLogs.splice(0, stdLogs.length)
        this.emit('minecraft-window-ready', { pid: processData.pid, ...options })
      })
      process.unref()

      return process.pid
    } catch (e) {
      this.error(e as Error)
      if (e instanceof LaunchException) {
        throw e
      }
      if (e instanceof Error) {
        if (!e.stack) {
          e.stack = new Error().stack
        }
        if (e.name === 'Error') {
          Object.assign(e, {
            name: 'LaunchGeneralError',
          })
        }
      }
      throw e
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
  async createLaunchShortcut(options: CreateLaunchShortcutOptions): Promise<void> {
    const iconUrl = options.icon

    const instanceIcoPath = process.platform === 'win32'
      ? join(options.instancePath, 'icon.ico')
      : join(options.instancePath, 'icon.png')
    if (iconUrl) {
      const { body } = await this.app.protocol.handle({ method: "GET", url: iconUrl, })
      let buffer: Buffer
      if (body) {
        if (body instanceof Buffer) {
          buffer = body
        } else if (body instanceof Readable) {
          const buffers = [] as Buffer[]
          body.on('data', (b) => {
            buffers.push(b)
          })
          await finished(body)
          buffer = Buffer.concat(buffers)
        } else {
          buffer = Buffer.from(body)
        }
        if (process.platform === 'win32') {
          const result = createICO(buffer, 0, 0, true, true)
          if (result) {
            buffer = result
          }
        }
        await writeFile(instanceIcoPath, buffer)
      }
    }

    const shortcutOptions: ShortcutOptions = {}

    if (process.platform === 'win32') {
      const c = vbTextContent
      const vbPath = join(this.app.appDataPath, 'vbscript.vbs')
      await writeFile(vbPath, c, { encoding: 'utf-8' })
      shortcutOptions.windows = {
        VBScriptPath: vbPath,
        filePath: process.execPath,
        outputPath: dirname(options.destination),
        name: basename(options.destination),
        icon: instanceIcoPath,
        arguments: `launch "${options.userId}" "${options.instancePath}"`,
      }
      if (!existsSync(shortcutOptions.windows!.icon!)) {
        delete shortcutOptions.windows.icon
      }
    } else {
      const outputDir = dirname(options.destination)
      const absoluteOutputDir = require("path").resolve(outputDir)
      await ensureDir(absoluteOutputDir)
      shortcutOptions.linux = {
        filePath: process.execPath,
        outputPath: absoluteOutputDir,
        name: basename(options.destination),
        icon: instanceIcoPath,
        arguments: `launch "${options.userId}" "${options.instancePath}"`,
      }
      if (!existsSync(shortcutOptions.linux!.icon!)) {
        delete shortcutOptions.linux.icon
      }
    }

    createDesktopShortcut(shortcutOptions)
  }
}
