import { ServiceKey } from './Service'

export type LaunchEvidenceAvailability = 'available' | 'absent' | 'ambiguous'

export interface LaunchHistoryRecord {
  launchId: string
  operationId: string
  pid: number
  side: 'client' | 'server'
  version: string
  minecraft: string
  state: 'running' | 'exited'
  startedAt: number
  readyAt?: number
  endedAt?: number
  exitCode?: number
  signal?: string
  crashed?: boolean
  evidence: {
    gameLog: LaunchEvidenceAvailability
    debugLog: LaunchEvidenceAvailability
    crashReport: LaunchEvidenceAvailability
    launcherOutput: LaunchEvidenceAvailability
  }
}

/**
 * Provide the ability to list/read/remove log and crash reports of a instance.
 */
export interface InstanceLogService {
  listLaunches(instancePath: string): Promise<LaunchHistoryRecord[]>
  getLaunch(instancePath: string, launchId: string): Promise<LaunchHistoryRecord | undefined>
  getLaunchEvidence(instancePath: string, launchId: string, name: 'game.log' | 'debug.log' | 'crash-report.txt' | 'launcher-output.log'): Promise<string>
  findLaunchByCrashReport(instancePath: string, name: string): Promise<LaunchHistoryRecord | undefined>
  /**
   * List the log in current instances
   */
  listLogs(instancePath: string): Promise<string[]>
  /**
   * Remove a log from disk
   * @param name The log file name
   */
  removeLog(instancePath: string, name: string): Promise<void>
  /**
   * Get the log content.
   * @param name The log file name
   */
  getLogContent(instancePath: string, name: string): Promise<string>
  /**
   * List the dedicated-server logs in `<instance>/server/logs/`.
   */
  listServerLogs(instancePath: string): Promise<string[]>
  /**
   * Remove a dedicated-server log from disk
   * @param name The log file name
   */
  removeServerLog(instancePath: string, name: string): Promise<void>
  /**
   * Get the dedicated-server log content.
   * @param name The log file name
   */
  getServerLogContent(instancePath: string, name: string): Promise<string>
  /**
   * Show the dedicated-server log file on disk. This will open a file explorer.
   * @param name The log file name
   */
  showServerLog(instancePath: string, name: string): void
  /**
   * List crash reports in current instance
   */
  listCrashReports(instancePath: string): Promise<string[]>
  /**
   * Remove a crash report from disk
   * @param name The crash report file name
   */
  removeCrashReport(instancePath: string, name: string): Promise<void>
  /**
   * Get the crash report content
   * @param name The name of crash report
   */
  getCrashReportContent(instancePath: string, name: string): Promise<string>
  /**
   * Show the log file on disk. This will open a file explorer.
   * @param name The log file name
   */
  showLog(instancePath: string, name: string): void
  /**
   * Show a crash report on disk. This will open a file explorer.
   * @param name The crash report file name
   */
  showCrash(instancePath: string, name: string): void
}

export const InstanceLogServiceKey: ServiceKey<InstanceLogService> = 'InstanceLogService'
