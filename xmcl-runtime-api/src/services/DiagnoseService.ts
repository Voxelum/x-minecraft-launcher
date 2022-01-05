import { Issue, IssueRegistries, IssueReport } from '../entities/issue'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export class DiagnoseState {
  report: IssueRegistries = {
    missingVersion: { fixing: false, autofix: true, optional: false, actived: [] },
    missingVersionJar: { fixing: false, autofix: true, optional: false, actived: [] },
    missingAssetsIndex: { fixing: false, autofix: true, optional: false, actived: [] },
    missingVersionJson: { fixing: false, autofix: true, optional: false, actived: [] },
    missingLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
    missingAssets: { fixing: false, autofix: true, optional: false, actived: [] },

    corruptedVersionJar: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedAssetsIndex: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedVersionJson: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedLibraries: { fixing: false, autofix: true, optional: true, actived: [] },
    corruptedAssets: { fixing: false, autofix: true, optional: true, actived: [] },

    invalidJava: { fixing: false, autofix: true, optional: true, actived: [] },
    missingJava: { fixing: false, autofix: true, optional: false, actived: [] },

    unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
    incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
    incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
    missingAuthlibInjector: { fixing: false, autofix: true, optional: true, actived: [] },
    missingCustomSkinLoader: { fixing: false, autofix: true, optional: true, actived: [] },
    incompatibleJava: { fixing: false, autofix: false, optional: true, actived: [] },
    missingModsOnServer: { fixing: false, autofix: false, optional: false, actived: [] },
    loaderConflict: { fixing: false, autofix: true, optional: false, actived: [] },
    badInstall: { fixing: false, autofix: true, optional: false, actived: [] },

    userNotLogined: { fixing: false, autofix: false, optional: true, actived: [] },

    requireFabric: { fixing: false, autofix: false, optional: true, actived: [] },
    requireForge: { fixing: false, autofix: false, optional: true, actived: [] },
    requireFabricAPI: { fixing: false, autofix: false, optional: true, actived: [] },
  }

  get issues() {
    const issues: Issue[] = []

    for (const [id, reg] of Object.entries(this.report)) {
      if (reg.actived.length === 0) continue
      issues.push(...reg.actived.map(a => ({
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
          this.report[id].actived = Object.freeze(value) as any
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
export const DiagnoseServiceMethods: ServiceTemplate<DiagnoseService> = {
  report: undefined,
  fix: undefined,
  state: undefined,
}
