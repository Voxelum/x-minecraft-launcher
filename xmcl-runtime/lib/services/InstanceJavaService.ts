import { JavaVersion } from '@xmcl/core'
import { InstanceJavaService as IInstanceJavaService, InstanceSchema, InstanceState, IssueReport, JavaState, parseVersion } from '@xmcl/runtime-api'
import LauncherApp from '../app/LauncherApp'
import { missing } from '../util/fs'
import DiagnoseService from './DiagnoseService'
import InstanceService from './InstanceService'
import InstanceVersionService from './InstanceVersionService'
import JavaService from './JavaService'
import AbstractService, { Inject, Singleton, Subscribe } from './Service'
import VersionService from './VersionService'

export default class InstanceJavaService extends AbstractService implements IInstanceJavaService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app)

    diagnoseService.registerMatchedFix(['invalidJava'], () => {
      const matchingJava = this.getInstanceJava(true)?.path
      if (matchingJava) {
        this.instanceService.editInstance({ java: matchingJava })
      }
    })

    diagnoseService.registerMatchedFix(['missingJava'], async ([issue]) => {
      const matchingJava = this.getInstanceJava(true)?.path
      if (matchingJava) {
        await this.instanceService.editInstance({ java: matchingJava })
      } else {
        const param = issue.parameters instanceof Array ? issue.parameters[0] : issue.parameters
        await this.javaService.installDefaultJava(param.targetVersion)
      }
    })

    new Promise<void>((resolve) => {
      let state = 0
      const listener = (serv: AbstractService) => {
        if (serv instanceof InstanceService || serv instanceof JavaService || serv instanceof VersionService) {
          state += 1
          if (state === 3) {
            this.app.removeListener('service-ready', listener)
            resolve()
          }
        }
      }
      this.app.on('service-ready', listener)
    }).then(() => {
      this.storeManager.subscribeAll(['javaUpdate', 'javaRemove', 'instanceSelect'], async () => {
        await this.diagnoseJava()
      })
      this.diagnoseJava()
    })
  }

  /**
   * Get java for current active instance.
   * It can only return the java with the version matched with launching requirement.
   * @param validOnly The param to determine if this will only return a valid java
   */
  getInstanceJava(validOnly = false) {
    const javaPath = this.instanceService.state.instance.java
    if (javaPath && javaPath !== '') {
      return this.javaService.state.all.find(j => j.path === javaPath && (!validOnly || j.valid))
    }
    const javaVersion = this.instanceVersionService.getInstanceVersion().javaVersion
    return this.javaService.getJavaForVersion(javaVersion, validOnly)
  }

  @Subscribe('instanceEdit')
  async onInstance(payload: InstanceSchema & { path: string }) {
    if (payload.path !== this.instanceService.state.path) {
      return
    }
    if ('java' in payload || 'runtime' in payload) {
      await this.diagnoseJava()
    }
  }

  @Singleton()
  async diagnoseJava() {
    this.up('diagnose')
    try {
      this.log('Diagnose java')
      const report: Partial<IssueReport> = {}
      const instance = this.instanceService.state.instance
      const instanceJava = this.getInstanceJava()

      const mcversion = instance.runtime.minecraft
      const resolvedVersion = this.instanceVersionService.getInstanceVersion()
      const resolvedMcVersion = parseVersion(mcversion)

      const tree: Pick<IssueReport, 'incompatibleJava' | 'invalidJava' | 'missingJava'> = {
        incompatibleJava: [],
        missingJava: [],
        invalidJava: [],
      }

      if (!instanceJava || this.javaService.state.missingJava) {
        tree.missingJava.push({ targetVersion: resolvedVersion.javaVersion })
      } else if (!instanceJava.valid || await missing(instanceJava.path)) {
        if (this.javaService.state.all.length === 0) {
          tree.missingJava.push({ targetVersion: resolvedVersion.javaVersion })
        } else {
          tree.invalidJava.push({ java: instanceJava.path })
        }
      } else if (instanceJava.majorVersion > 8 && resolvedVersion.javaVersion.majorVersion === 8) {
        if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
          // 1.13 below does not support higher java
          tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft', targetVersion: resolvedVersion.javaVersion })
        } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && instanceJava.majorVersion > 10) {
          if (resolvedMcVersion.minorVersion < 17) {
            tree.incompatibleJava.push({ java: instanceJava.version, version: instance.runtime.forge, type: 'MinecraftForge', targetVersion: resolvedVersion.javaVersion })
          }
        }
      }

      if (resolvedVersion.javaVersion.majorVersion > 8 && instanceJava) {
        if (resolvedVersion.javaVersion.majorVersion !== instanceJava.majorVersion) {
          tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft', targetVersion: resolvedVersion.javaVersion })
        }
      }

      Object.assign(report, tree)
      this.diagnoseService.report(report)
    } finally {
      this.down('diagnose')
    }
  }
}
