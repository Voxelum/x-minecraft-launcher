import { ResolvedVersion } from '@xmcl/core'
import { IncompatibleJavaIssueKey, InstanceJavaService as IInstanceJavaService, InstanceJavaServiceKey, InstanceJavaState, InvalidJavaIssueKey, IssueReport, Java, JavaRecord, MissingJavaIssueKey, parseVersion, IssueReportBuilder } from '@xmcl/runtime-api'
import { relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { missing } from '../util/fs'
import { DiagnoseService } from './DiagnoseService'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { JavaService } from './JavaService'
import { AbstractService, Inject, Singleton, StatefulService } from './Service'
import { VersionService } from './VersionService'

interface VersionPreference {
  match: (v: Java) => boolean
  okay: (v: Java) => boolean
  requirement: string
}
export class InstanceJavaService extends StatefulService<InstanceJavaState> implements IInstanceJavaService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app, InstanceJavaServiceKey, () => new InstanceJavaState())

    diagnoseService.register({
      id: InvalidJavaIssueKey,
      fix: async () => {
        const matchingJava = this.state.java?.path
        if (matchingJava) {
          await this.instanceService.editInstance({ java: matchingJava })
        }
      },
    })

    diagnoseService.register({
      id: IncompatibleJavaIssueKey,
      fix: async (issue) => {
        const matchingJava = this.state.java?.path
        if (matchingJava) {
          await this.instanceService.editInstance({ java: matchingJava })
        } else {
          if (issue.targetVersion) {
            await this.javaService.installDefaultJava(issue.targetVersion)
          }
        }
      },
    })

    diagnoseService.register({
      id: MissingJavaIssueKey,
      fix: async (issue) => {
        const missingJavaIssue = issue
        if (missingJavaIssue.targetVersion) {
          this.javaService.installDefaultJava(missingJavaIssue.targetVersion)
        }
      },
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
        await this.updateJava()
      })
      this.updateJava()
    })
    this.storeManager.subscribe('instanceEdit', async (payload) => {
      if (payload.path === this.instanceService.state.path) {
        if ('java' in payload || 'runtime' in payload) {
          await this.updateJava()
        }
      }
    })
  }

  private getSortedJava({ match, okay }: VersionPreference) {
    const records = [...this.javaService.state.all.filter(v => v.valid)]
    const root = this.getPath('jre')
    const isUnderPath = (p: string) => !relative(root, p).startsWith('..')
    const bestMatched: JavaRecord[] = []
    const fine: JavaRecord[] = []
    const bad: JavaRecord[] = []
    for (const j of records) {
      if (match(j)) {
        bestMatched.push(j)
      } else if (okay(j)) {
        fine.push(j)
      } else {
        bad.push(j)
      }
    }
    bestMatched.sort((a, b) => isUnderPath(a.path) ? -1 : 1)
    fine.sort((a, b) => isUnderPath(a.path) ? -1 : 1)
    if (bestMatched.length > 0) {
      return [bestMatched[0], 0] as const
    }
    if (fine.length > 0) {
      return [fine[0], 1] as const
    }
    return [bad[0], 2] as const
  }

  /**
   * Get java for current active instance.
   * It can only return the java with the version matched with launching requirement.
   * @param validOnly The param to determine if this will only return a valid java
   */
  @Singleton()
  async updateJava() {
    this.up('diagnose')
    const builder = new IssueReportBuilder()
    try {
      this.log('Diagnose java')
      // instance related info
      const instance = this.instanceService.state.instance
      const { minecraft, forge, java: javaPath } = instance.runtime
      const selectedVersion = this.instanceVersionService.state.version
      const javaVersion = selectedVersion?.javaVersion
      const resolvedMcVersion = parseVersion(minecraft)
      const minecraftMinor = resolvedMcVersion.minorVersion!

      builder.set(InvalidJavaIssueKey).set(MissingJavaIssueKey).set(IncompatibleJavaIssueKey)

      const allJava = this.javaService.state.all

      let instanceJava: JavaRecord | undefined

      const getBuilderNumber = (v: string) => {
        const [, build] = v.split('_')
        const buildNumber = Number(build)
        return buildNumber
      }

      // user assigned java
      // if (javaPath && javaPath !== '') {
      //   instanceJava = allJava.find(j => j.path === javaPath)

      //   // pre-check if the user selected path is not in our cache
      //   if (instanceJava && (!instanceJava.path || !instanceJava.valid || await this.javaService.validateJavaPath(instanceJava.path))) {
      //     builder.set(InvalidJavaIssueKey, { path: instanceJava.path })
      //     this.diagnoseService.report(builder.build())
      //     return
      //   }

      //   if (!instanceJava) {
      //     // no java
      //     builder.set(MissingJavaIssueKey, { targetVersion: undefined })
      //     this.diagnoseService.report(builder.build())
      //     return
      //   }

      //   if (instanceJava.majorVersion > 8 && javaVersion.majorVersion === 8) {
      //     if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
      //       // 1.13 below does not support higher java
      //       builder.set(IncompatibleJavaIssueKey, { java: instanceJava.version, version: minecraft, cause: 'Minecraft', targetVersion: javaVersion })
      //     } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && instanceJava.majorVersion > 10) {
      //       if (resolvedMcVersion.minorVersion < 17) {
      //         builder.set(IncompatibleJavaIssueKey, { java: instanceJava.version, version: instance.runtime.forge, cause: 'MinecraftForge', targetVersion: javaVersion })
      //       }
      //     }
      //   }

      //   if (instanceJava && instanceJava?.majorVersion === 8) {
      //     const [, build] = instanceJava.version.split('_')
      //     const buildNumber = Number(build)
      //     if (buildNumber >= 321 && forge) {
      //       // forge not compatible with 321 jre
      //       builder.set(IncompatibleJavaIssueKey, { java: instanceJava.version, version: forge, cause: 'MinecraftForge', targetVersion: javaVersion })
      //     }
      //   }

      //   if (javaVersion.majorVersion > 8 && instanceJava) {
      //     if (javaVersion.majorVersion !== instanceJava.majorVersion) {
      //       builder.set(IncompatibleJavaIssueKey, { java: instanceJava.version, version: minecraft, cause: 'MinecraftForge', targetVersion: javaVersion })
      //     }
      //   }
      // } else {
      // user not assigned, calculate from our side
      let status = 0
      if (allJava.length === 0) {
        builder.set(MissingJavaIssueKey, { targetVersion: undefined })
        this.diagnoseService.report(builder.build())
        return
      }

      let preferredMatchedVersion: undefined | ((j: Java) => boolean)

      if (javaVersion) {
        // if it assign version officially, we need to
        preferredMatchedVersion = (j) => j.majorVersion === javaVersion.majorVersion
      }
      let versionPref: VersionPreference
      // instance version is not installed
      if (minecraftMinor < 13) {
        // need java 8 for version below 1.13
        versionPref = {
          match: preferredMatchedVersion || ((j) => j.majorVersion === 8),
          okay: j => j.majorVersion < 8 || j.majorVersion < 11,
          requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '=8',
        }
      } else if (minecraftMinor >= 13 && minecraftMinor < 17) {
        if (instance.runtime.forge) {
          // use java 8 if forge as forge only compatible with jre8
          versionPref = {
            match: (j) => j.majorVersion === 8 && getBuilderNumber(j.version) < 321,
            okay: (j) => j.majorVersion === 8,
            requirement: '<8_321',
          }
        } else {
          // use greater java if no forge
          versionPref = {
            match: preferredMatchedVersion || (j => j.majorVersion >= 8 && j.majorVersion <= 16),
            okay: _ => true,
            requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=8,<=16',
          }
        }
      } else {
        // new mc use new java
        versionPref = {
          match: preferredMatchedVersion || (j => j.majorVersion >= 16),
          okay: _ => true,
          requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=16',
        }
      }

      if (javaPath && javaPath !== '') {
        const record = await this.javaService.resolveJava(javaPath)
        if (!record) {
          // invalid
          builder.set(InvalidJavaIssueKey, { path: javaPath })
        } else {
          if (versionPref.match(record)) {
            status = 0
          } else if (versionPref.okay(record)) {
            status = 1
          } else {
            status = 2
          }
        }
      } else {
        [instanceJava, status] = this.getSortedJava(versionPref)
      }

      if (status === 1) {
        // not best match
        builder.set(IncompatibleJavaIssueKey, {
          minecraft,
          forge: instance.runtime.forge || '',
          java: instanceJava?.path || '',
          version: selectedVersion?.id || '',
          requirement: versionPref.requirement,
          targetVersion: javaVersion,
        })
      } else if (status === 2) {
        // might not be compatible
        builder.set(IncompatibleJavaIssueKey, {
          minecraft,
          forge: instance.runtime.forge || '',
          java: instanceJava?.path || '',
          version: selectedVersion?.id || '',
          requirement: versionPref.requirement,
          targetVersion: javaVersion,
        })
      }

      this.diagnoseService.report(builder.build())
    } finally {
      this.down('diagnose')
    }
  }
}
