import { createMinecraftProcessWatcher, generateArguments, launch, LaunchOption, MinecraftFolder, Version } from '@xmcl/core'
import { ChildProcess } from 'child_process'
import { EOL } from 'os'
import LauncherApp from '../app/LauncherApp'
import DiagnoseService from './DiagnoseService'
import ExternalAuthSkinService from './ExternalAuthSkinService'
import InstanceResourceService from './InstanceResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import { Exception } from '/@shared/entities/exception'
import { LaunchService as ILaunchService, LaunchServiceKey } from '/@shared/services/LaunchService'

@ExportService(LaunchServiceKey)
export default class LaunchService extends AbstractService implements ILaunchService {
  constructor(app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(ExternalAuthSkinService) private externalAuthSkinService: ExternalAuthSkinService,
    @Inject(InstanceResourceService) private instanceResourceService: InstanceResourceService,
  ) {
    super(app)
  }

  private launchedProcess: ChildProcess | undefined

  async generateArguments() {
    const instance = this.getters.instance
    const user = this.getters.user
    const gameProfile = this.getters.gameProfile

    const minecraftFolder = new MinecraftFolder(instance.path)
    const javaPath = this.getters.instanceJava.path || this.getters.defaultJava.path

    const instanceVersion = this.getters.instanceVersion
    if (!instanceVersion.id) {
      throw new Exception({ type: 'launchNoVersionInstalled' })
    }
    const version = instanceVersion.id
    const useAuthLib = user.authService !== 'mojang' && user.authService !== 'offline'

    /**
       * Build launch condition
       */
    const option: LaunchOption = {
      gameProfile,
      accessToken: user.accessToken,
      properties: {},
      gamePath: minecraftFolder.root,
      resourcePath: this.getPath(),
      javaPath,
      minMemory: instance.minMemory && instance.minMemory > 0 ? instance.minMemory : undefined,
      maxMemory: instance.maxMemory && instance.maxMemory > 0 ? instance.maxMemory : undefined,
      version,
      extraExecOption: {
        detached: true,
        cwd: minecraftFolder.root,
      },
      extraJVMArgs: instance.vmOptions,
      extraMCArgs: instance.mcOptions,
      yggdrasilAgent: useAuthLib ? {
        jar: await this.externalAuthSkinService.installAuthlibInjection(),
        server: this.getters.authService.hostName,
      } : undefined,
    }

    return generateArguments(option)
  }

  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @param force
   * @returns Does this launch request success?
   */
  async launch(force?: boolean) {
    try {
      if (this.state.launch.status !== 'ready') {
        return false
      }

      this.commit('launchStatus', 'checkingProblems')

      /**
           * current selected profile
           */
      const instance = this.getters.instance
      const user = this.getters.user
      const gameProfile = this.getters.gameProfile
      if (user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
        throw new Exception({ type: 'launchIllegalAuth' })
      }

      for (let problems = this.getters.issues.filter(p => p.autofix), i = 0;
        problems.length !== 0 && i < 1;
        problems = this.getters.issues.filter(p => p.autofix), i += 1) {
        await this.diagnoseService.fix(this.getters.issues.filter(p => !p.optional && p.autofix))
      }

      if (!force && this.getters.issues.some(p => !p.optional)) {
        throw new Exception({ type: 'launchBlockedIssues', issues: this.getters.issues.filter(p => !p.optional) })
      }

      if (this.state.launch.status === 'ready') { // check if we have cancel (set to ready) this launch
        return false
      }

      this.commit('launchStatus', 'launching')

      const minecraftFolder = new MinecraftFolder(instance.path)

      let version = this.getters.instanceVersion
      if (!version.id) {
        throw new Exception({ type: 'launchNoVersionInstalled' })
      }
      version = await Version.parse(version.minecraftDirectory, version.id)

      this.log(`Will launch with ${version} version.`)

      const javaPath = this.getters.instanceJava.path || this.getters.defaultJava.path

      await this.instanceResourceService.ensureResourcePacksDeployment()
      const useAuthLib = user.authService !== 'mojang' && user.authService !== 'offline' && user.authService !== 'microsoft'

      /**
           * Build launch condition
           */
      const option: LaunchOption = {
        gameProfile,
        accessToken: user.accessToken,
        properties: {},
        gamePath: minecraftFolder.root,
        resourcePath: this.getPath(),
        javaPath,
        minMemory: instance.minMemory > 0 ? instance.minMemory : undefined,
        maxMemory: instance.maxMemory > 0 ? instance.maxMemory : undefined,
        version,
        extraExecOption: {
          detached: true,
          cwd: minecraftFolder.root,
        },
        extraJVMArgs: instance.vmOptions,
        extraMCArgs: instance.mcOptions,
        yggdrasilAgent: useAuthLib ? {
          jar: await this.externalAuthSkinService.installAuthlibInjection(),
          server: this.getters.authService.hostName,
        } : undefined,
      }

      if ('server' in instance && instance.server?.host) {
        this.log('Launching a server')
        option.server = {
          ip: instance.server?.host,
          port: instance.server?.port,
        }
      }

      this.log('Launching with these option...')
      this.log(JSON.stringify(option, (k, v) => (k === 'accessToken' ? '***' : v), 2))

      // Launch
      const process = await launch(option)
      this.launchedProcess = process
      this.commit('launchStatus', 'launched')

      this.app.emit('minecraft-start', {
        version: version.id,
        minecraft: version.minecraftVersion,
        forge: instance.runtime.forge ?? '',
        fabricLoader: instance.runtime.fabricLoader ?? '',
      })
      const watcher = createMinecraftProcessWatcher(process)
      const errorLogs = [] as string[]

      process.stderr?.on('data', (buf: any) => {
        errorLogs.push(...buf.toString().split(EOL))
      })
      watcher.on('error', (err) => {
        this.pushException({ type: 'launchGeneralException', error: err })
        this.commit('launchStatus', 'ready')
      }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
        this.log(`Minecraft exit: ${code}, signal: ${signal}`)
        if (crashReportLocation) {
          crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4)
        }
        this.app.emit('minecraft-exit', {
          code,
          signal,
          crashReport,
          crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
          errorLog: errorLogs.join('\n'),
        })
        this.commit('launchStatus', 'ready')
        this.launchedProcess = undefined
      }).on('minecraft-window-ready', () => {
        this.app.emit('minecraft-window-ready')
      })
      /* eslint-disable no-unused-expressions */
      process.stdout?.on('data', (s) => {
        const string = s.toString()
        this.app.emit('minecraft-stdout', string)
      })
      process.stderr?.on('data', (s) => {
        this.warn(s.toString())
        this.app.emit('minecraft-stderr', s.toString())
      })
      process.unref()
      return true
    } catch (e) {
      this.commit('launchStatus', 'ready')
      this.error(e)
      throw new Exception({ type: 'launchGeneralException', error: e })
    }
  }
}
