import filenamify from 'filenamify'
import { createWriteStream, WriteStream } from 'fs'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { join, resolve } from 'path'
import { PassThrough, pipeline, Transform } from 'stream'
import { format } from 'util'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { IS_DEV } from '../constant'
import { Logger } from '../util/log'
import { gzip } from '../util/zip'

function formatMsg(message: any, options: any[]) { return options.length !== 0 ? format(message, options) : format(message) }
function baseTransform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}\n`) } }) }

export default class LogManager extends Manager {
  private loggerEntries = { log: baseTransform('INFO'), warn: baseTransform('WARN'), error: baseTransform('ERROR') }

  private output = new PassThrough()

  private logRoot = ''

  private openedStream: { [name: string]: WriteStream } = {}

  private hasError = false

  constructor(app: LauncherApp) {
    super(app)

    pipeline(this.loggerEntries.log, this.output, () => { })
    pipeline(this.loggerEntries.warn, this.output, () => { })
    pipeline(this.loggerEntries.error, this.output, () => { })

    this.loggerEntries.error.once('data', () => {
      this.hasError = true
    })

    process.on('uncaughtException', (err) => {
      this.error('Uncaught Exception')
      this.error(err)
    })
    process.on('unhandledRejection', (reason) => {
      this.error('Uncaught Rejection')
      this.error(reason)
    })
    if (IS_DEV) {
      this.loggerEntries.log.on('data', (b) => {
        console.log(b.toString())
      })
      this.loggerEntries.warn.on('data', (b) => {
        console.warn(b.toString())
      })
      this.loggerEntries.error.on('data', (b) => {
        console.error(b.toString())
      })
    }
  }

  readonly log = (message: any, ...options: any[]) => { this.loggerEntries.log.write(formatMsg(message, options)) }

  readonly warn = (message: any, ...options: any[]) => { this.loggerEntries.warn.write(formatMsg(message, options)) }

  readonly error = (message: any, ...options: any[]) => { this.loggerEntries.error.write(formatMsg(message, options)) }

  getLogRoot() {
    return this.logRoot
  }

  getLogger(tag: string): Logger {
    const { loggerEntries } = this
    return {
      log(message: any, ...options: any[]) {
        loggerEntries.log.write(`[${tag}] ${formatMsg(message, options)}`)
      },
      warn(message: any, ...options: any[]) {
        if (message instanceof Error) { message = message.stack }
        loggerEntries.warn.write(`[${tag}] ${formatMsg(message, options)}`)
      },
      error(message: any, ...options: any[]) {
        if (message instanceof Error) { message = message.stack }
        loggerEntries.error.write(`[${tag}] ${formatMsg(message, options)}`)
      },
    }
  }

  openWindowLog(name: string) {
    const loggerPath = resolve(this.logRoot, `renderer.${name}.log`)
    this.log(`Setup renderer logger for window ${name} to ${loggerPath}`)
    const stream = createWriteStream(loggerPath, { encoding: 'utf-8', flags: 'w+' })
    this.openedStream[name] = stream
    return stream
  }

  closeWindowLog(name: string) {
    this.openedStream[name].close()
  }

  async setOutputRoot(root: string) {
    this.logRoot = resolve(root, 'logs')
    await ensureDir(this.logRoot)
    const mainLog = join(this.logRoot, 'main.log')
    const stream = createWriteStream(mainLog, { encoding: 'utf-8', flags: 'w+' })
    this.output.pipe(stream)
    this.openedStream.MAIN_LOG = stream
    this.log(`Set log root to ${root}`)
  }

  async dispose() {
    const mainLog = this.openedStream.MAIN_LOG
    mainLog.close()
    const mainLogPath = join(this.logRoot, 'main.log')
    if (this.hasError) {
      await writeFile(join(this.logRoot, filenamify(new Date().toJSON()) + '.log.gz'), await gzip(await readFile(mainLogPath)))
    }
  }
}
