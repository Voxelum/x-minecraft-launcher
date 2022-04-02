import { DiagnoseService as IDiagnoseService, DiagnoseServiceException, DiagnoseServiceKey, DiagnoseState, Issue, IssueReport } from '@xmcl/runtime-api'
import { basename } from 'path'
import LauncherApp from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import { ExportService, Singleton, StatefulService } from './Service'

export type DiagnoseFunction = (report: Partial<IssueReport>) => Promise<void>

export interface Fix {
  match(issues: readonly Issue[]): boolean
  fix(issues: readonly Issue[]): Promise<void>
  recheck: DiagnoseFunction
}

/**
 * This is the service provides the diagnose service for current launch profile
 */
@ExportService(DiagnoseServiceKey)
export default class DiagnoseService extends StatefulService<DiagnoseState> implements IDiagnoseService {
  private fixes: Fix[] = []

  private postIssue = new AggregateExecutor<Partial<IssueReport>, Partial<IssueReport>>(r => r.reduce((prev, cur) => Object.assign(prev, cur), {}),
    (report) => this.state.issuesPost(report),
    500)

  constructor(app: LauncherApp) {
    super(app)
  }

  createState(): DiagnoseState {
    return new DiagnoseState()
  }

  registerMatchedFix(matched: string[], fixFunc: (issues: Issue[]) => Promise<any> | void, recheck: DiagnoseFunction = async () => { }) {
    this.fixes.push({
      match(issues) {
        return issues.some(i => matched.indexOf(i.id) !== -1)
      },
      fix(issues) {
        const filtered = issues.filter(i => matched.indexOf(i.id) !== -1)
        const result = fixFunc(filtered)
        if (result instanceof Promise) { return result.then(() => { }) }
        return Promise.resolve(result)
      },
      recheck,
    })
  }

  @Singleton()
  async diagnoseFailure(log: string) {
    const tree: Pick<IssueReport, 'badForge'> = {
      badForge: [],
    }

    const lines = log.split('\n').map(l => l.trim()).filter(l => l.length !== 0)
    for (const line of lines) {
      const reg = line.match(/\[main\/FATAL\] \[net\.minecraftforge\.fml\.loading\.FMLCommonLaunchHandler\/CORE\]: Failed to find Minecraft resource version/)
      if (reg) {
        const path = reg[2]
        const jarName = basename(path)
        const [, minecraft, forge] = jarName.substring(0, jarName.length - '-client.jar'.length).split('-')
        tree.badForge.push({ minecraft, forge })
      }
    }

    this.report(tree)
  }

  // @Singleton()
  // async diagnoseServer(report: Partial<IssueReport>) {
  //   this.acquire('diagnose')
  //   try {
  //     this.log('Diagnose server status')
  //     const stat = this.getters.instance.serverStatus

  //     const tree: Pick<IssueReport, 'missingModsOnServer'> = {
  //       missingModsOnServer: [],
  //     }

  //     if (stat && stat.modinfo) {
  //       const info = stat.modinfo
  //       tree.missingModsOnServer.push(...info.modList)
  //     }

  //     Object.assign(report, tree)
  //   } finally {
  //     this.release('diagnose')
  //   }
  // }

  /**
   * Report certain issues.
   * @param report The partial issue report
   */
  report(report: Partial<IssueReport>) {
    for (const [key, value] of Object.entries(report)) {
      const reg = this.state.report[key]
      if (value && reg.activeIssues.length === 0 && value.length === 0) {
        delete report[key]
      }
    }
    this.postIssue.push(report)
  }

  /**
   * Fix all provided issues
   * @param issues The issues to be fixed.
   */
  async fix(issues: readonly Issue[]) {
    this.up('diagnose')
    try {
      const unfixed = issues.filter(p => p.autofix)
        .filter(p => !this.state.report[p.id].fixing)

      if (unfixed.length === 0) return

      this.log(`Start fixing ${issues.length} issues: ${JSON.stringify(issues.map(i => i.id))}`)

      const rechecks: Array<DiagnoseFunction> = []

      this.state.issuesStartResolve(unfixed)
      try {
        for (const fix of this.fixes) {
          if (fix.match(issues)) {
            await fix.fix(issues).catch(e => {
              this.emit('error', new DiagnoseServiceException({ type: 'issueFix', error: e }))
            })
            if (fix.recheck) {
              rechecks.push(fix.recheck)
            }
          }
        }

        const report: Partial<IssueReport> = {}
        await Promise.all(rechecks.map(r => r(report)))
        this.report(report)
      } finally {
        this.state.issuesEndResolve(unfixed)
      }
    } finally {
      this.down('diagnose')
    }
  }
}
