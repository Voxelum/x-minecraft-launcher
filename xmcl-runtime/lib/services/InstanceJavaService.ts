import { IncompatibleJavaIssueKey, InstanceJavaService as IInstanceJavaService, InstanceJavaServiceKey, InstanceJavaState, InvalidJavaIssueKey, IssueReportBuilder, Java, JavaCompatibleState, JavaRecord, MissingJavaIssueKey, parseVersion } from '@xmcl/runtime-api'
import { relative } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { DiagnoseService } from './DiagnoseService'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { JavaService } from './JavaService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

interface VersionPreference {
  match: (v: Java) => boolean
  okay: (v: Java) => boolean
  requirement: string
}

@ExposeServiceKey(InstanceJavaServiceKey)
export class InstanceJavaService extends StatefulService<InstanceJavaState> implements IInstanceJavaService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app, InstanceJavaServiceKey, () => new InstanceJavaState())

    diagnoseService.register({
      id: InvalidJavaIssueKey,
      fix: async (issue) => {
        if (issue.recommendedVersion) {
          await this.instanceService.editInstance({ java: issue.recommendedVersion.path })
        } else if (issue.recommendedDownload) {
          await this.javaService.installDefaultJava(issue.recommendedDownload)
        }
      },
    })

    diagnoseService.register({
      id: IncompatibleJavaIssueKey,
      fix: async (issue) => {
        if (issue.recommendedVersion) {
          await this.instanceService.editInstance({ java: issue.recommendedVersion.path })
        } else if (issue.recommendedDownload) {
          await this.javaService.installDefaultJava(issue.recommendedDownload)
        }
      },
    })

    diagnoseService.register({
      id: MissingJavaIssueKey,
      fix: async (issue) => {
        const missingJavaIssue = issue
        if (missingJavaIssue.recommendedDownload) {
          this.javaService.installDefaultJava(missingJavaIssue.recommendedDownload)
        }
      },
    })

    Promise.all([instanceService.initialize(), javaService.initialize(), instanceVersionService.initialize()]).then(() => {
      this.storeManager
        .subscribe('instanceVersion', (ver) => {
          this.updateJava()
        })
        .subscribe('javaRemove', (j) => {
          if (j.path === this.state.java?.path) {
            this.updateJava()
          }
        })
        .subscribe('javaUpdate', (j) => {
          if (this.state.java) {
            if (j instanceof Array) {
              if (j.some(java => java.path === this.state.java?.path)) {
                this.updateJava()
              }
            } else if (j.path === this.state.java?.path) {
              this.updateJava()
            } else if (
              diagnoseService.state.report[InvalidJavaIssueKey as string].parameters.length > 0 ||
              diagnoseService.state.report[IncompatibleJavaIssueKey as string]?.parameters.length > 0 ||
              diagnoseService.state.report[MissingJavaIssueKey as string]?.parameters.length > 0
            ) {
              this.updateJava()
            }
          } else {
            this.updateJava()
          }
        })
        .subscribe('instanceEdit', async (payload) => {
          if (payload.path === this.instanceService.state.path) {
            if ('runtime' in payload) {
              // wait instanceVersion change
              return
            }
            if ('java' in payload) {
              await this.updateJava()
            }
          }
        })
      this.updateJava()
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
      return [bestMatched[0], JavaCompatibleState.Matched] as const
    }
    if (fine.length > 0) {
      return [fine[0], JavaCompatibleState.MayIncompatible] as const
    }
    return [bad[0], JavaCompatibleState.VeryLikelyIncompatible] as const
  }

  /**
   * Get java for current active instance.
   * It can only return the java with the version matched with launching requirement.
   */
  @Singleton()
  async updateJava() {
    this.up('diagnose')
    const builder = new IssueReportBuilder()
    try {
      this.log('Diagnose java')
      // instance related info
      const instance = this.instanceService.state.instance
      const { minecraft, forge } = instance.runtime
      const javaPath = instance.java
      const selectedVersion = this.instanceVersionService.state.version
      let javaVersion = selectedVersion?.javaVersion
      const resolvedMcVersion = parseVersion(minecraft)
      const minecraftMinor = resolvedMcVersion.minorVersion!

      builder.set(InvalidJavaIssueKey).set(MissingJavaIssueKey).set(IncompatibleJavaIssueKey)

      const allJava = this.javaService.state.all

      const getBuilderNumber = (v: string) => {
        const [, build] = v.split('_')
        const buildNumber = Number(build)
        return buildNumber
      }

      let preferredMatchedVersion: undefined | ((j: Java) => boolean)

      if (javaVersion) {
        const v = javaVersion
        // if it assign version officially, we need to
        preferredMatchedVersion = (j) => j.majorVersion === v.majorVersion
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
        if (!javaVersion) {
          javaVersion = {
            component: 'jre-legacy',
            majorVersion: 8,
          }
        }
      } else if (minecraftMinor >= 13 && minecraftMinor < 17) {
        if (instance.runtime.forge) {
          // use java 8 if forge as forge only compatible with jre8
          versionPref = {
            match: (j) => j.majorVersion === 8 && getBuilderNumber(j.version) < 321,
            okay: (j) => j.majorVersion === 8,
            requirement: '<8_321',
          }
          if (!javaVersion) {
            javaVersion = {
              component: 'jre-legacy',
              majorVersion: 8,
            }
          }
        } else {
          // use greater java if no forge
          versionPref = {
            match: preferredMatchedVersion || (j => j.majorVersion >= 8 && j.majorVersion <= 16),
            okay: _ => true,
            requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=8,<=16',
          }
          if (!javaVersion) {
            javaVersion = {
              component: 'jre-legacy',
              majorVersion: 8,
            }
          }
        }
      } else {
        // new mc use new java
        versionPref = {
          match: preferredMatchedVersion || (j => j.majorVersion >= 16),
          okay: _ => true,
          requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=16',
        }
        if (!javaVersion) {
          javaVersion = {
            component: 'java-runtime-alpha',
            majorVersion: 16,
          }
        }
      }

      if (allJava.length === 0) {
        builder.set(MissingJavaIssueKey, {
          recommendedDownload: javaVersion,
          requirement: versionPref.requirement,
          version: selectedVersion?.id || '',
          minecraft,
          forge: forge ?? '',
        })
        this.state.instanceJava(undefined)
        this.diagnoseService.report(builder.build())
        return
      }

      let resultQuality = JavaCompatibleState.Matched
      let resultJava: Java
      const [computedJava, computedQuality] = this.getSortedJava(versionPref)

      const userAssigned = javaPath && javaPath !== ''
      if (userAssigned) {
        const record = await this.javaService.resolveJava(javaPath)

        if (!record) {
          // invalid java
          builder.set(InvalidJavaIssueKey, {
            selectedJavaPath: javaPath,

            recommendedDownload: javaVersion,
            recommendedVersion: computedJava,
            recommendedLevel: resultQuality,

            requirement: versionPref.requirement,
            version: selectedVersion?.id || '',
            minecraft,
            forge: forge ?? '',
          })

          this.state.instanceJava({
            valid: false,
            path: javaPath,
            version: '',
            majorVersion: -1,
          })
          this.diagnoseService.report(builder.build())
          return
        }

        // check if this version matched
        if (versionPref.match(record)) {
          resultQuality = JavaCompatibleState.Matched
        } else if (versionPref.okay(record)) {
          resultQuality = JavaCompatibleState.MayIncompatible
        } else {
          resultQuality = JavaCompatibleState.VeryLikelyIncompatible
        }
        resultJava = record
      } else {
        resultQuality = computedQuality
        resultJava = computedJava
      }

      if (resultQuality !== JavaCompatibleState.Matched) {
        // not the best match
        builder.set(IncompatibleJavaIssueKey, {
          selectedJava: resultJava,

          recommendedDownload: javaVersion,
          recommendedVersion: computedJava,
          recommendedLevel: computedQuality,

          version: selectedVersion?.id || '',
          minecraft,
          forge: instance.runtime.forge || '',
          requirement: versionPref.requirement,
        })
      }

      this.state.instanceJava({ ...resultJava, valid: true })
      this.diagnoseService.report(builder.build())
    } finally {
      this.down('diagnose')
    }
  }
}
