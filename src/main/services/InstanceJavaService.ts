import LauncherApp from '../app/LauncherApp'
import { missing } from '../util/fs'
import DiagnoseService from './DiagnoseService'
import InstanceService from './InstanceService'
import JavaService from './JavaService'
import AbstractService, { Inject, internal, Singleton, StatefulService, Subscribe } from './Service'
import { InstanceSchema } from '/@shared/entities/instance.schema'
import { IssueReport } from '/@shared/entities/issue'
import { EMPTY_JAVA } from '/@shared/entities/java'
import { InstanceJavaService as IInstanceJavaService, InstanceJavaState } from '/@shared/services/InstanceJavaService'
import { InstanceState } from '/@shared/services/InstanceService'
import { JavaState } from '/@shared/services/JavaService'
import { parseVersion } from '/@shared/util/mavenVersion'

export default class InstanceJavaService extends StatefulService<InstanceJavaState, [InstanceState, JavaState]> implements IInstanceJavaService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app, [instanceService.state, javaService.state])

    diagnoseService.registerMatchedFix(['invalidJava'], () => {
      this.instanceService.editInstance({ java: this.javaService.state.defaultJava.path })
    })

    new Promise<void>((resolve) => {
      let state = 0
      const listener = (serv: AbstractService) => {
        if (serv instanceof InstanceService || serv instanceof JavaService) {
          state += 1
          if (state === 2) {
            this.app.removeListener('service-ready', listener)
            resolve()
          }
        }
      }
      this.app.on('service-ready', listener)
    }).then(() => {
      this.storeManager.subscribeAll(['javaUpdate', 'javaRemove'], async () => {
        const defaultJava = this.javaService.state.defaultJava
        if (!defaultJava.valid) {
          await this.instanceService.editInstance({ java: defaultJava.path })
        }
        await this.diagnoseJava()
      })
    })
  }

  createState([instance, java]: [InstanceState, JavaState]) {
    return new InstanceJavaState(instance, java)
  }

  @Subscribe('instanceSelect')
  @internal
  async onInstanceSelect() {
    await this.diagnoseJava()
  }

  @Subscribe('instanceEdit')
  @internal
  async onInstance(payload: InstanceSchema & { path: string }) {
    if (payload.path !== this.instanceService.state.path) {
      return
    }
    if ('java' in payload || 'runtime' in payload) {
      await this.diagnoseJava()
    }
  }

  async ensureJavaEnvironment() {
    const instance = this.instanceService.state.instance
    const instanceJava = this.state.instanceJava

    const mcversion = instance.runtime.minecraft
    const resolvedMcVersion = parseVersion(mcversion)

    if (instanceJava === EMPTY_JAVA || this.javaService.state.missingJava) {
      this.javaService.installDefaultJava('8')
    }
  }

  @Singleton()
  async diagnoseJava() {
    this.up('diagnose')
    try {
      this.log('Diagnose java')
      const report: Partial<IssueReport> = {}
      const instance = this.instanceService.state.instance
      const instanceJava = this.state.instanceJava

      const mcversion = instance.runtime.minecraft
      const resolvedMcVersion = parseVersion(mcversion)

      const tree: Pick<IssueReport, 'incompatibleJava' | 'invalidJava' | 'missingJava'> = {
        incompatibleJava: [],
        missingJava: [],
        invalidJava: [],
      }

      if (instanceJava === EMPTY_JAVA || this.javaService.state.missingJava) {
        tree.missingJava.push({})
      } else if (!instanceJava.valid || await missing(instanceJava.path)) {
        if (this.javaService.state.all.length === 0) {
          tree.missingJava.push({})
        } else {
          tree.invalidJava.push({ java: instanceJava.path })
        }
      } else if (instanceJava.majorVersion > 8) {
        if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
          tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft', targetVersion: '8' })
        } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && instanceJava.majorVersion > 10) {
          if (resolvedMcVersion.minorVersion < 17) {
            tree.incompatibleJava.push({ java: instanceJava.version, version: instance.runtime.forge, type: 'MinecraftForge', targetVersion: '8' })
          }
        }
      }

      if (resolvedMcVersion.minorVersion && resolvedMcVersion.minorVersion >= 17) {
        if (instanceJava.majorVersion < 16) {
          tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft', targetVersion: '16' })
        }
      }

      Object.assign(report, tree)
      this.diagnoseService.report(report)
    } finally {
      this.down('diagnose')
    }
  }
}
