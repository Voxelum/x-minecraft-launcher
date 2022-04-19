
export interface Issue<T = Record<string, any>> {
  id: string
  parameters: T[]
  autoFix?: boolean
  optional?: boolean
  fixing: boolean
}

export interface IssueKey<T> extends String { }

export function isIssue<T>(key: IssueKey<T>, issue: Issue<unknown>): issue is Issue<T> {
  return issue.id === key
}

export interface IssueReport {
  [key: string]: any[]
}

export class IssueReportBuilder {
  issues: Record<string, any[]> = {}

  set<T>(issueKey: IssueKey<T>, issue?: T): this {
    if (!this.issues[issueKey as string]) {
      this.issues[issueKey as string] = []
    }
    if (issue) {
      this.issues[issueKey as string].push(issue)
    }
    return this
  }

  build(): IssueReport {
    return this.issues
  }
}
