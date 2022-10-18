import { computed, InjectionKey } from 'vue'
import { DiagnoseSemaphoreKey, DiagnoseServiceKey, Issue, IssueKey } from '@xmcl/runtime-api'
import { injection } from '../util/inject'
import { useBusy } from './semaphore'
import { useService } from './service'

export const IssueHandlerKey: InjectionKey<IssueHandler> = Symbol('IssueHandlerKey')

export class IssueHandler {
  handlers: Record<string, (content: any) => void > = {}

  handle(issue: Issue): boolean {
    const handler = this.handlers[issue.id]
    if (handler) {
      handler(issue.parameters[0])
      return true
    }
    return false
  }

  register<T>(key: IssueKey<T>, handler: (content: T) => void): void {
    this.handlers[key as string] = handler
  }
}

export function useIssues() {
  const { state, fix: fixIssue } = useService(DiagnoseServiceKey)
  const handlers = injection(IssueHandlerKey)
  const issues = computed(() => Object.values(state.report).filter(v => v.parameters.length > 0))
  const refreshing = useBusy(DiagnoseSemaphoreKey)

  function fix(issue: Issue, issues: readonly Issue[]) {
    if (!handlers.handle(issue)) {
      return fixIssue(issues)
    }
  }

  return {
    issues,
    refreshing,
    fix,
  }
}
