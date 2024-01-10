import { InstanceLogService as IInstanceLogService, InstanceLogServiceKey } from '@xmcl/runtime-api'
import { readFile, unlink } from 'fs-extra'
import { isAbsolute, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { EncodingWorker, kEncodingWorker } from '~/encoding'
import { UTF8 } from '../util/encoding'
import { readdirIfPresent } from '../util/fs'
import { gunzip } from '../util/zip'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { AnyError } from '../util/error'

/**
 * Provide the ability to list/read/remove log and crash reports of a instance.
 */
@ExposeServiceKey(InstanceLogServiceKey)
export class InstanceLogService extends AbstractService implements IInstanceLogService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kEncodingWorker) private encoder: EncodingWorker,
  ) {
    super(app)
  }

  /**
   * List the log in current instances
   */
  @Singleton()
  async listLogs(instancePath: string) {
    const files = await readdirIfPresent(join(instancePath, 'logs'))
    return files.filter(f => f.endsWith('.gz') || f.endsWith('.txt') || f.endsWith('.log'))
  }

  /**
   * Remove a log from disk
   * @param name The log file name
   */
  @Singleton(name => name)
  async removeLog(instancePath: string, name: string) {
    const filePath = join(instancePath, 'logs', name)
    this.log(`Remove log ${filePath}`)
    await unlink(filePath)
  }

  /**
   * Get the log content.
   * @param name The log file name
   */
  @Singleton(name => name)
  async getLogContent(instancePath: string, name: string) {
    try {
      const filePath = join(instancePath, 'logs', name)
      let buf = await readFile(filePath)
      if (name.endsWith('.gz')) {
        buf = await gunzip(buf)
      }
      const encoding = await this.encoder.guessEncodingByBuffer(buf.subarray(0, 512 * 128)).catch(e => undefined)
      const result = await this.encoder.decode(buf, encoding || UTF8)
      return result
    } catch (e) {
      this.error(new AnyError('GetLogContentError', `Fail to get log content "${name}"`, { cause: e }))
      return ''
    }
  }

  /**
   * List crash reports in current instance
   */
  @Singleton()
  async listCrashReports(instancePath: string) {
    const files = await readdirIfPresent(join(instancePath, 'crash-reports'))
    return files.filter(f => f.endsWith('.gz') || f.endsWith('.txt'))
  }

  /**
   * Remove a crash report from disk
   * @param name The crash report file name
   */
  @Singleton((name) => name)
  async removeCrashReport(instancePath: string, name: string) {
    const filePath = join(instancePath, 'crash-reports', name)
    this.log(`Remove crash report ${filePath}`)
    await unlink(filePath)
  }

  /**
   * Get the crash report content
   * @param name The name of crash report
   */
  @Singleton((name) => name)
  async getCrashReportContent(instancePath: string, name: string) {
    let filePath: string
    if (isAbsolute(name)) {
      filePath = name
    } else {
      filePath = join(instancePath, 'crash-reports', name)
    }
    try {
      let buf = await readFile(filePath.trim())
      if (name.endsWith('.gz')) {
        buf = await gunzip(buf)
      }
      const encoding = await this.encoder.guessEncodingByBuffer(buf.subarray(0, 512 * 128)).catch(() => undefined)
      const result = await this.encoder.decode(buf, encoding || UTF8)
      return result
    } catch (e) {
      this.error(new AnyError('GetCrashContentError', `Fail to get log content "${name}"`, { cause: e }))
      return ''
    }
  }

  /**
   * Show the log file on disk. This will open a file explorer.
   * @param name The log file name
   */
  showLog(instancePath: string, name: string) {
    const filePath = join(instancePath, 'logs', name)
    this.app.shell.showItemInFolder(filePath)
  }

  /**
   * Show a crash report on disk. This will open a file explorer.
   * @param name The crash report file name
   */
  showCrash(instancePath: string, name: string) {
    const filePath = join(instancePath, 'crash-reports', name)
    this.app.shell.showItemInFolder(filePath)
  }
}
