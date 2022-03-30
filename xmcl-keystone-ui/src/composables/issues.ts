import { computed, inject, InjectionKey } from '@vue/composition-api'
import { DiagnoseServiceKey, Issue } from '@xmcl/runtime-api'
import { useBusy } from './semaphore'
import { useService } from './service'

export const IssueHandler: InjectionKey<Record<string, (issue: Issue) => void>> = Symbol('IssueHandler')

export function useIssues() {
  const { state, fix: fixIssue } = useService(DiagnoseServiceKey)
  const handlers = inject(IssueHandler, {})
  const issues = computed(() => {
    const issues: Issue[] = []
    for (const [id, reg] of Object.entries(state.report)) {
      if (reg.activeIssues.length === 0) continue
      if (reg.activeIssues.length >= 4) {
        issues.push({
          id,
          parameters: reg.activeIssues,
          autofix: reg.autofix,
          optional: reg.optional,
        })
      } else {
        issues.push(...reg.activeIssues.map(a => ({
          id,
          parameters: a,
          autofix: reg.autofix,
          optional: reg.optional,
        })))
      }
    }
    return issues
  })
  const refreshing = useBusy('diagnose')

  function fix(issue: Issue, issues: readonly Issue[]) {
    console.log(`Fix issue ${issue.id}`)
    const handler = handlers[issue.id]
    if (handler) {
      handler(issue)
    } else if (issue.autofix) {
      fixIssue(issues)
    } else {
      console.error(`Cannot fix the issue ${issue.id} as it's not implemented`)
    }
  }

  return {
    issues,
    refreshing,
    fix,
  }
}
