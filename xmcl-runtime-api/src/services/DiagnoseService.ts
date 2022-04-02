import { Exception } from '../entities/exception'
import { Issue, IssueRegistries, IssueReport } from '../entities/issue'
import { ServiceKey, StatefulService } from './Service'

export class DiagnoseState {
  report: IssueRegistries = {
    missingVersion: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    missingVersionJar: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    missingAssetsIndex: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    missingVersionJson: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    missingLibraries: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    missingAssets: { fixing: false, autofix: true, optional: false, activeIssues: [] },

    corruptedVersionJar: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    corruptedAssetsIndex: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    corruptedVersionJson: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    corruptedLibraries: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    corruptedAssets: { fixing: false, autofix: true, optional: true, activeIssues: [] },

    invalidJava: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    missingJava: { fixing: false, autofix: true, optional: false, activeIssues: [] },

    unknownMod: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    incompatibleMod: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    incompatibleResourcePack: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    missingAuthlibInjector: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    missingCustomSkinLoader: { fixing: false, autofix: true, optional: true, activeIssues: [] },
    incompatibleJava: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    missingModsOnServer: { fixing: false, autofix: false, optional: false, activeIssues: [] },
    loaderConflict: { fixing: false, autofix: true, optional: false, activeIssues: [] },
    badInstall: { fixing: false, autofix: true, optional: false, activeIssues: [] },

    userNotLogined: { fixing: false, autofix: false, optional: true, activeIssues: [] },

    requireFabric: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    requireForge: { fixing: false, autofix: false, optional: true, activeIssues: [] },
    requireFabricAPI: { fixing: false, autofix: false, optional: true, activeIssues: [] },
  }

  get issues() {
    const issues: Issue[] = []

    for (const [id, reg] of Object.entries(this.report)) {
      if (reg.activeIssues.length === 0) continue
      issues.push(...reg.activeIssues.map(a => ({
        id,
        parameters: a,
        autofix: reg.autofix,
        optional: reg.optional,
        multi: false,
      })))
    }
    return issues
  }

  issuesPost(issues: Partial<IssueReport>) {
    for (const [id, value] of Object.entries(issues)) {
      if (value instanceof Array) {
        if (!this.report[id]) {
          throw new Error(`This should not happen! Missing problem registry ${id}.`)
        } else {
          this.report[id].activeIssues = Object.freeze(value) as any
        }
      }
    }
  }

  issuesStartResolve(issues: Issue[]) {
    issues.forEach((p) => {
      this.report[p.id].fixing = true
    })
  }

  issuesEndResolve(issues: Issue[]) {
    issues.forEach((p) => {
      this.report[p.id].fixing = false
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

export type DiagnoseServiceExceptions = {
  type: 'issueFix'
  error: unknown
}

export class DiagnoseServiceException extends Exception<DiagnoseServiceExceptions> { }
