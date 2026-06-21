import { ServiceKey } from './Service'

/**
 * Filename prefix used by LaunchService to persist the launcher-captured
 * stderr / stdout when Minecraft exits abnormally. Files matching this
 * prefix in `<instance>/logs/` are surfaced as "Launch Failures" in the
 * UI so the user can revisit them after dismissing the crash dialog.
 *
 * Keep in sync with LaunchService.#persistAbnormalExitLog.
 */
export const LAUNCH_FAILURE_PREFIX = 'xmcl-abnormal-exit-'

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
   * List the launcher-captured abnormal-exit dumps in `<instance>/logs/`.
   * Sorted most-recent-first. See {@link LAUNCH_FAILURE_PREFIX}.
   */
  listLaunchFailures(instancePath: string): Promise<string[]>
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
