import { createMinecraftProcessWatcher, diagnoseJar, diagnoseLibraries, generateArguments, launch, LaunchOption, LaunchPrecheck, MinecraftFolder, ResolvedVersion, Version } from '@xmcl/core'
import { LaunchException, LaunchOptions, LaunchService as ILaunchService, LaunchServiceKey, LaunchState } from '@xmcl/runtime-api'
import { ChildProcess } from 'child_process'
import { EOL } from 'os'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { JavaValidation } from '../entities/java'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { DiagnoseService } from './DiagnoseService'
import { ExternalAuthSkinService } from './ExternalAuthSkinService'
import { InstallService } from './InstallService'
import { InstanceJavaService } from './InstanceJavaService'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { JavaService } from './JavaService'
import { ExposeServiceKey, StatefulService } from './Service'
import { UserService } from './UserService'

@ExposeServiceKey(LaunchServiceKey)
export class LaunchService extends StatefulService<LaunchState> implements ILaunchService {
  private launchedProcesses: ChildProcess[] = []

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(ExternalAuthSkinService) private externalAuthSkinService: ExternalAuthSkinService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstallService) private installService: InstallService,
    @Inject(InstanceJavaService) private instanceJavaService: InstanceJavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, () => new LaunchState())
  }

  async generateArguments() {
    const instance = this.instanceService.state.instance
    const user = this.userService.state
    const gameProfile = user.gameProfile

    const minecraftFolder = new MinecraftFolder(instance.path)
    const instanceJava = this.instanceJavaService.state.java
    if (!instanceJava) {
      throw new Error('No valid java')
    }
    const javaPath = instanceJava.path

    const instanceVersion = this.instanceVersionService.state.version

    if (!instanceVersion) {
      throw new LaunchException({
        type: 'launchNoVersionInstalled',
        version: instance.version,
        minecraft: instance.runtime.minecraft,
        forge: instance.runtime.forge,
        fabric: instance.runtime.fabricLoader,
      })
    }
    const version = instanceVersion.id

    const minMemory = instance.assignMemory === true && instance.minMemory > 0
      ? instance.minMemory
      : instance.assignMemory === 'auto' ? Math.floor((await this.baseService.getMemoryStatus()).free / 1024 / 1024 - 256) : undefined
    const maxMemory = instance.assignMemory === true && instance.maxMemory > 0 ? instance.maxMemory : undefined

    const yggdrasilHost = user.user ? this.userService.getAccountSystem(user.user?.authService)?.getYggdrasilHost?.() : undefined
    let yggdrasilAgent: LaunchOption['yggdrasilAgent']
    if (yggdrasilHost) {
      try {
        const jar = await this.externalAuthSkinService.installAuthLibInjection()
        yggdrasilAgent = {
          jar,
          server: yggdrasilHost,
        }
      } catch (e) {
        this.error('Fail to install authlib-injection:\n %o', e)
      }
    }
    /**
     * Build launch condition
     */
    const option: LaunchOption = {
      gameProfile,
      accessToken: user.user?.accessToken,
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
      extraJVMArgs: instance.vmOptions,
      extraMCArgs: instance.mcOptions,
      yggdrasilAgent,
    }

    return generateArguments(option)
  }

  async kill() {
    if (this.launchedProcesses.length > 0) {
      const last = this.launchedProcesses.pop()
      last!.kill()
    }
  }

  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @returns Does this launch request success?
   */
  async launch(options?: LaunchOptions) {
    try {
      if (this.state.status !== 'idle') {
        return false
      }

      this.state.launchStatus('checkingProblems')

      /**
       * current selected profile
       */
      const instance = this.instanceService.state.instance
      const user = this.userService.state
      const gameProfile = user.gameProfile

      if (!options?.ignoreUserStatus && !instance.fastLaunch) {
        try {
          await this.userService.refreshUser()
        } catch (e) {
          // if (e instanceof UserException) {
          //   throw new LaunchException({
          //     type: 'launchUserStatusRefreshFailed',
          //     userException: e.exception,
          //   })
          // }
          this.warn(`Fail to determine user status to launch: ${e}`)
        }
      }

      if (!options?.force && !instance.fastLaunch) {
        await this.semaphoreManager.wait('diagnose')
        const issues = this.diagnoseService.state.issues
        for (let problems = issues.filter(p => p.autoFix && p.parameters.length > 0), i = 0;
          problems.length !== 0 && i <= 2;
          problems = issues.filter(p => p.autoFix && p.parameters.length > 0), i += 1) {
          await this.diagnoseService.fix(problems)
        }
      }

      if (this.state.status === 'idle') { // check if we have cancel (set to ready) this launch
        return false
      }

      const yggdrasilHost = user.user ? this.userService.getAccountSystem(user.user?.authService)?.getYggdrasilHost?.() : undefined
      let yggdrasilAgent: LaunchOption['yggdrasilAgent']

      if (yggdrasilHost) {
        this.state.launchStatus('injectingAuthLib')
        try {
          const jar = await this.externalAuthSkinService.installAuthLibInjection()
          yggdrasilAgent = {
            jar,
            server: yggdrasilHost,
          }
        } catch (e) {
          this.error('Fail to install authlib-injection:\n %o', e)
        }
      }

      const minecraftFolder = new MinecraftFolder(options?.gameDirectory ?? instance.path)

      let version: ResolvedVersion | undefined

      if (options?.version) {
        this.log(`Override the version: ${options.version}`)
        try {
          version = await Version.parse(this.getPath(), options.version)
        } catch (e) {
          this.warn(`Cannot use override version: ${options.version}`)
          this.warn(e)
        }
      } else {
        version = this.instanceVersionService.state.version
      }

      if (!version) {
        throw new LaunchException({
          type: 'launchNoVersionInstalled',
          override: options?.version,
          minecraft: instance.runtime.minecraft,
          forge: instance.runtime.forge,
          fabric: instance.runtime.fabricLoader,
        })
      }

      if (!options?.force && !instance.fastLaunch) {
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

      this.state.launchStatus('launching')

      this.log(`Will launch with ${version.id} version.`)

      const instanceJava = this.instanceJavaService.state.java

      const javaPath = instance.java || instanceJava?.path

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      const minMemory = instance.assignMemory === true && instance.minMemory > 0
        ? instance.minMemory
        : instance.assignMemory === 'auto' ? Math.floor((await this.baseService.getMemoryStatus()).free / 1024 / 1024 - 256) : undefined
      const maxMemory = instance.assignMemory === true && instance.maxMemory > 0 ? instance.maxMemory : undefined
      const prechecks = [LaunchPrecheck.checkNatives, LaunchPrecheck.linkAssets]

      /**
       * Build launch condition
       */
      const option: LaunchOption = {
        gameProfile,
        accessToken: user.user?.accessToken,
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
        extraJVMArgs: instance.vmOptions,
        extraMCArgs: instance.mcOptions,
        launcherBrand: options?.launcherBrand ?? '',
        launcherName: options?.launcherName ?? 'XMCL',
        yggdrasilAgent,
        prechecks,
      }

      if (options?.server) {
        this.log('Launching a server')
        option.server = {
          ip: options.server.host,
          port: options.server?.port,
        }
      } else if ('server' in instance && instance.server?.host) {
        this.log('Launching a server')
        option.server = {
          ip: instance.server?.host,
          port: instance.server?.port,
        }
      }

      this.log('Launching with these option...')
      this.log(JSON.stringify(option, (k, v) => (k === 'accessToken' ? '***' : v), 2))

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

      // Launch
      const process = await launch(option)
      this.launchedProcesses.push(process)
      process.on('spawn', () => {
        this.state.launchCount(this.state.activeCount + 1)
      }).on('close', () => {
        this.state.launchCount(this.state.activeCount - 1)
      })

      this.emit('minecraft-start', {
        pid: process.pid,
        version: version.id,
        minecraft: version.minecraftVersion,
        forge: instance.runtime.forge ?? '',
        fabricLoader: instance.runtime.fabricLoader ?? '',
      })
      const watcher = createMinecraftProcessWatcher(process)
      const errorLogs = [] as string[]

      process.stderr?.on('data', (buf: any) => {
        const lines = buf.toString().split(EOL)
        errorLogs.push(...lines)
      })
      watcher.on('error', (err) => {
        this.emit('error', new LaunchException({ type: 'launchGeneralException', error: err }))
      }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
        this.log(`Minecraft exit: ${code}, signal: ${signal}`)
        if (crashReportLocation) {
          crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4)
        }
        this.emit('minecraft-exit', {
          pid: process.pid,
          code,
          signal,
          crashReport,
          crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
          errorLog: errorLogs.join('\n'),
        })
        this.launchedProcesses = this.launchedProcesses.filter(p => p !== process)
      }).on('minecraft-window-ready', () => {
        this.emit('minecraft-window-ready', { pid: process.pid })
      })
      /* eslint-disable no-unused-expressions */
      process.stdout?.on('data', (s) => {
        const string = s.toString()
        this.emit('minecraft-stdout', { pid: process.pid, stdout: string })
      })
      process.stderr?.on('data', (s: Buffer) => {
        this.warn(s.toString('utf8'))
        this.emit('minecraft-stderr', { pid: process.pid, stderr: s.toString() })
      })
      process.unref()
      this.state.launchStatus('idle')

      return true
    } catch (e) {
      this.state.launchStatus('idle')

      if (e instanceof LaunchException) {
        throw e
      }
      this.error(e)
      throw new LaunchException({ type: 'launchGeneralException', error: { ...(e as any), message: (e as any).message, stack: (e as any).stack } })
    }
  }
}
