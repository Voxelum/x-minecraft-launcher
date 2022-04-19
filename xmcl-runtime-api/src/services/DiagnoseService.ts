import { Exception } from '../entities/exception'
import { Issue, IssueReport } from '../entities/issue'
import { ServiceKey, StatefulService } from './Service'

export class DiagnoseState {
  get issues(): Issue[] {
    return Object.values(this.report)
  }

  report: Record<string, Issue> = {}

  issueRegister(issue: Issue) {
    this.report[issue.id] = issue
  }

  issuesPost(issues: Partial<IssueReport>) {
    for (const [id, value] of Object.entries(issues)) {
      if (value instanceof Array) {
        if (!this.report[id]) {
          throw new Error(`This should not happen! Missing problem registry ${id}.`)
        } else {
          this.report[id].parameters = Object.freeze(value) as any
        }
      }
    }
  }

  issuesStartResolve(issues: string[]) {
    issues.forEach((p) => {
      this.report[p].fixing = true
    })
  }

  issuesEndResolve(issues: string[]) {
    issues.forEach((p) => {
      this.report[p].fixing = false
    })
  }
}
/**
 * This is the service provides the diagnose service for current launch profile
 */
export interface DiagnoseService extends StatefulService<DiagnoseState> {
  /**
   * Report certain issues.
   * @param report The partial issue report
   */
  report(report: Partial<IssueReport>): void
  /**
   * Fix all provided issues
   * @param issues The issues to be fixed.
   */
  fix(issues: readonly Issue[]): Promise<void>
}

export const DiagnoseServiceKey: ServiceKey<DiagnoseService> = 'DiagnoseService'

export const DiagnoseSemaphoreKey = 'diagnose'

export type DiagnoseServiceExceptions = {
  type: 'issueFix'
  error: unknown
}

export class DiagnoseServiceException extends Exception<DiagnoseServiceExceptions> { }
