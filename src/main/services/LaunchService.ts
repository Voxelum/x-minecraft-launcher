import { createMinecraftProcessWatcher, generateArguments, launch, LaunchOption, MinecraftFolder, Version } from '@xmcl/core'
import { ChildProcess } from 'child_process'
import { EOL } from 'os'
import LauncherApp from '../app/LauncherApp'
import DiagnoseService from './DiagnoseService'
import ExternalAuthSkinService from './ExternalAuthSkinService'
import InstanceJavaService from './InstanceJavaService'
import InstanceResourcePackService from './InstanceResourcePacksService'
import InstanceService from './InstanceService'
import InstanceVersionService from './InstanceVersionService'
import JavaService from './JavaService'
import { ExportService, Inject, StatefulService } from './Service'
import UserService from './UserService'
import { Exception } from '/@shared/entities/exception'
import { LaunchState, LaunchService as ILaunchService, LaunchServiceKey } from '/@shared/services/LaunchService'

@ExportService(LaunchServiceKey)
export default class LaunchService extends StatefulService<LaunchState> implements ILaunchService {
  private launchedProcess: ChildProcess | undefined

  createState() { return new LaunchState() }

  constructor(app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(ExternalAuthSkinService) private externalAuthSkinService: ExternalAuthSkinService,
    @Inject(InstanceResourcePackService) private instanceResourceService: InstanceResourcePackService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceJavaService) private instanceJavaService: InstanceJavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app)
  }

  async generateArguments() {
    const instance = this.instanceService.state.instance
    const user = this.userService.state
    const gameProfile = user.gameProfile

    const minecraftFolder = new MinecraftFolder(instance.path)
    const javaPath = this.instanceJavaService.state.instanceJava.path || this.javaService.state.defaultJava.path

    const instanceVersion = this.instanceVersionService.state.instanceVersion
    if (!instanceVersion.id) {
      throw new Exception({ type: 'launchNoVersionInstalled' })
    }
    const version = instanceVersion.id
    const useAuthLib = this.userService.state.isThirdPartyAuthentication

    /**
       * Build launch condition
       */
    const option: LaunchOption = {
      gameProfile,
      accessToken: user.user.accessToken,
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
        server: user.authService.hostName,
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
      if (this.state.status !== 'ready') {
        return false
      }

      this.state.launchStatus('checkingProblems')

      /**
       * current selected profile
       */
      const instance = this.instanceService.state.instance
      const user = this.userService.state
      const gameProfile = user.gameProfile
      if (user.user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
        throw new Exception({ type: 'launchIllegalAuth' })
      }

      const issues = this.diagnoseService.state.issues
      for (let problems = issues.filter(p => p.autofix), i = 0;
        problems.length !== 0 && i < 1;
        problems = issues.filter(p => p.autofix), i += 1) {
        await this.diagnoseService.fix(issues.filter(p => !p.optional && p.autofix))
      }

      // if (!force && issues.some(p => !p.optional)) {
      //   throw new Exception({ type: 'launchBlockedIssues', issues: issues.filter(p => !p.optional) })
      // }

      if (this.state.status === 'ready') { // check if we have cancel (set to ready) this launch
        return false
      }

      this.state.launchStatus('launching')

      const minecraftFolder = new MinecraftFolder(instance.path)

      let version = this.instanceVersionService.state.instanceVersion
      if (!version.id) {
        throw new Exception({ type: 'launchNoVersionInstalled' })
      }
      version = await Version.parse(version.minecraftDirectory, version.id)

      this.log(`Will launch with ${version} version.`)

      const javaPath = this.instanceJavaService.state.instanceJava.path || this.javaService.state.defaultJava.path

      await this.instanceResourceService.ensureResourcePacksDeployment()
      const useAuthLib = user.isThirdPartyAuthentication

      /**
           * Build launch condition
           */
      const option: LaunchOption = {
        gameProfile,
        accessToken: user.user.accessToken,
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
          server: user.authService.hostName,
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
      this.state.launchStatus('launched')

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
        this.state.launchStatus('ready')
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
        this.state.launchStatus('ready')
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
      this.state.launchStatus('ready')
      this.error(e)
      throw new Exception({ type: 'launchGeneralException', error: e })
    }
  }
}
