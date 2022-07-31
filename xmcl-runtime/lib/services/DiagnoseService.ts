import { DiagnoseService as IDiagnoseService, DiagnoseServiceException, DiagnoseServiceKey, DiagnoseState, Issue, IssueKey, IssueReport, IssueReportBuilder } from '@xmcl/runtime-api'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { AggregateExecutor } from '../util/aggregator'
import { Inject } from '../util/objectRegistry'
import { StatefulService } from './Service'

export interface IssueDescriptor<I> {
  id: IssueKey<I>
  merge?: (issues: I[]) => I
  fix?: (issue: I) => Promise<void>
  /**
   * This will run after the issue
   */
  validator?: (builder: IssueReportBuilder, issue: I) => Promise<void>
}

/**
 * This is the service provides the diagnose service for current launch profile
 */
export class DiagnoseService extends StatefulService<DiagnoseState> implements IDiagnoseService {
  private descriptors: Record<string, IssueDescriptor<any>> = {}

  private postIssue = new AggregateExecutor<Record<string, any>, Record<string, any>>(r => r.reduce((prev, cur) => {
    for (const [key, val] of Object.entries(cur)) {
      prev[key] = val
    }
    return prev
  }, {}),
  (report) => this.state.issuesPost(report),
  500)

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, DiagnoseServiceKey, () => new DiagnoseState())
  }

  register<T>(descriptor: IssueDescriptor<T>) {
    this.state.issueRegister({
      id: descriptor.id as string,
      autoFix: !!descriptor.fix,
      optional: true,
      parameters: [],
      fixing: false,
    })
    this.descriptors[descriptor.id as string] = descriptor
  }

  // @Singleton()
  // async diagnoseFailure(log: string) {
  //   const tree: Pick<IssueReport, 'badForge'> = {
  //     badForge: [],
  //   }

  //   const lines = log.split('\n').map(l => l.trim()).filter(l => l.length !== 0)
  //   for (const line of lines) {
  //     const reg = line.match(/\[main\/FATAL\] \[net\.minecraftforge\.fml\.loading\.FMLCommonLaunchHandler\/CORE\]: Failed to find Minecraft resource version/)
  //     if (reg) {
  //       const path = reg[2]
  //       const jarName = basename(path)
  //       const [, minecraft, forge] = jarName.substring(0, jarName.length - '-client.jar'.length).split('-')
  //       tree.badForge.push({ minecraft, forge })
  //     }
  //   }

  //   this.report(tree)
  // }

  /**
   * Report certain issues.
   * @param report The partial issue report
   */
  report(report: IssueReport) {
    const merged: Record<string, any> = {}
    for (const [k, v] of Object.entries(report)) {
      const merge = this.descriptors[k].merge
      if (v.length > 1) {
        if (merge) {
          merged[k] = [merge(v)]
        } else {
          merged[k] = [v[0]]
        }
      } else {
        merged[k] = v
      }
    }
    this.postIssue.push(merged)
  }

  /**
   * Fix all provided issues
   * @param issues The issues to be fixed.
   */
  async fix(issues: readonly Issue[]) {
    this.up('diagnose')
    try {
      const unfixed = issues.filter(p => p.autoFix)
        .filter(p => !this.state.report[p.id].fixing)

      if (unfixed.length === 0) return

      this.log(`Start fixing ${issues.length} issues: ${JSON.stringify(issues.map(i => i.id))}`)

      const postValidate: Array<() => Promise<void>> = []

      this.state.issuesStartResolve(unfixed.map(i => i.id))
      try {
        const builder = new IssueReportBuilder()
        for (const issue of issues) {
          const descriptor = this.descriptors[issue.id]
          if (descriptor.fix) {
            const current = issue.parameters[0]
            await descriptor.fix(current).catch(e => {
              this.emit('error', new DiagnoseServiceException({ type: 'issueFix', error: e }))
            })
            if (descriptor.validator) {
              const validator = descriptor.validator
              postValidate.push(() => validator(builder, current))
            }
          }
        }

        await Promise.all(postValidate.map(r => r()))
        this.state.issuesPost(builder.build())
      } finally {
        this.state.issuesEndResolve(unfixed.map(i => i.id))
      }
    } finally {
      this.down('diagnose')
    }
  }
}
