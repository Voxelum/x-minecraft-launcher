import { readFile, remove } from 'fs-extra'
import { isAbsolute, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { InstanceService } from './InstanceService'
import { AbstractService, Inject, Singleton } from './Service'
import { decode, guessEncodingByBuffer, UTF8 } from '../util/encoding'
import { readdirIfPresent } from '../util/fs'
import { gunzip } from '../util/zip'
import { InstanceLogService as IInstanceLogService, InstanceLogServiceKey } from '@xmcl/runtime-api'

/**
 * Provide the ability to list/read/remove log and crash reports of a instance.
 */
export class InstanceLogService extends AbstractService implements IInstanceLogService {
  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app, InstanceLogServiceKey)
  }

  /**
   * List the log in current instances
   */
  @Singleton()
  async listLogs() {
    const files = await readdirIfPresent(join(this.instanceService.state.path, 'logs'))
    return files.filter(f => f.endsWith('.gz') || f.endsWith('.txt') || f.endsWith('.log'))
  }

  /**
   * Remove a log from disk
   * @param name The log file name
   */
  @Singleton(name => name)
  async removeLog(name: string) {
    const filePath = join(this.instanceService.state.path, 'logs', name)
    this.log(`Remove log ${filePath}`)
    await remove(filePath)
  }

  /**
   * Get the log content.
   * @param name The log file name
   */
  @Singleton(name => name)
  async getLogContent(name: string) {
    try {
      const filePath = join(this.instanceService.state.path, 'logs', name)
      let buf = await readFile(filePath)
      if (name.endsWith('.gz')) {
        buf = await gunzip(buf)
      }
      const encoding = await guessEncodingByBuffer(buf).catch(e => undefined)
      const result = decode(buf, encoding || UTF8)
      return result
    } catch (e) {
      this.error(e)
      return ''
    }
  }

  /**
   * List crash reports in current instance
   */
  @Singleton()
  async listCrashReports() {
    const files = await readdirIfPresent(join(this.instanceService.state.path, 'crash-reports'))
    return files.filter(f => f.endsWith('.gz') || f.endsWith('.txt'))
  }

  /**
   * Remove a crash report from disk
   * @param name The crash report file name
   */
  @Singleton((name) => name)
  async removeCrashReport(name: string) {
    const filePath = join(this.instanceService.state.path, 'crash-reports', name)
    this.log(`Remove crash report ${filePath}`)
    await remove(filePath)
  }

  /**
   * Get the crash report content
   * @param name The name of crash report
   */
  @Singleton((name) => name)
  async getCrashReportContent(name: string) {
    let filePath: string
    if (isAbsolute(name)) {
      filePath = name
    } else {
      filePath = join(this.instanceService.state.path, 'crash-reports', name)
    }
    let buf = await readFile(filePath.trim())
    if (name.endsWith('.gz')) {
      buf = await gunzip(buf)
    }
    const encoding = await guessEncodingByBuffer(buf)
    const result = decode(buf, encoding || UTF8)
    return result
  }

  /**
   * Show the log file on disk. This will open a file explorer.
   * @param name The log file name
   */
  showLog(name: string) {
    const filePath = join(this.instanceService.state.path, 'logs', name)
    this.app.showItemInFolder(filePath)
  }

  /**
   * Show a crash report on disk. This will open a file explorer.
   * @param name The crash report file name
   */
  showCrash(name: string) {
    const filePath = join(this.instanceService.state.path, 'crash-reports', name)
    this.app.showItemInFolder(filePath)
  }
}
