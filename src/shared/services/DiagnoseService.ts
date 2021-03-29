import { ServiceKey } from './Service'
import { Issue, IssueReport } from '/@shared/entities/issue'
import { State } from '/@shared/store/modules/diagnose'
/**
 * This is the service provides the diagnose service for current launch profile
 */
export interface DiagnoseService {
  diagnoseMods(report: Partial<IssueReport>): Promise<void>
  diagnoseResourcePacks(report: Partial<IssueReport>): Promise<void>
  diagnoseUser(report: Partial<IssueReport>): Promise<void>
  diagnoseCustomSkin(report: Partial<IssueReport>): Promise<void>
  diagnoseJava(report: Partial<IssueReport>): Promise<void>
  diagnoseFailure(log: string): Promise<void>
  diagnoseServer(report: Partial<IssueReport>): Promise<void>
  diagnoseVersion(report: Partial<IssueReport>): Promise<void>
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
