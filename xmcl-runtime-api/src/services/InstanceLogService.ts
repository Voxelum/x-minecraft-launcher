import { ServiceKey } from './Service'

/**
 * Provide the ability to list/read/remove log and crash reports of a instance.
 */
export interface InstanceLogService {
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
