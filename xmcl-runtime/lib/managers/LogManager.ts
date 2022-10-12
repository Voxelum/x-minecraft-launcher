import filenamify from 'filenamify'
import { createWriteStream, WriteStream } from 'fs'
import { ensureDir, readFile, writeFile } from 'fs-extra'
import { join, resolve } from 'path'
import { PassThrough, pipeline, Transform } from 'stream'
import { format } from 'util'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { Logger } from '../util/log'
import { gzip, ZipTask } from '../util/zip'

function formatMsg(message: any, options: any[]) { return options.length !== 0 ? format(message, ...options) : format(message) }
function baseTransform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}`) } }) }

export default class LogManager extends Manager {
  private loggerEntries = { log: baseTransform('INFO'), warn: baseTransform('WARN'), error: baseTransform('ERROR') }

  private outputs: PassThrough[] = []

  private logRoot = ''

  private openedStream: { [name: string]: WriteStream } = {}

  private hasError = false

  constructor(app: LauncherApp) {
    super(app)

    const output = new PassThrough()
    pipeline(this.loggerEntries.log, output, () => { })
    pipeline(this.loggerEntries.warn, output, () => { })
    pipeline(this.loggerEntries.error, output, () => { })
    this.outputs.push(output)
    Reflect.set(output, 'name', 'MAIN')

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

  openLogger(name: string) {
    const output = new PassThrough()

    const log = baseTransform('INFO')
    const warn = baseTransform('WARN')
    const error = baseTransform('ERROR')

    pipeline(log, output, () => { })
    pipeline(warn, output, () => { })
    pipeline(error, output, () => { })

    this.outputs.push(output)
    Reflect.set(output, 'name', name)

    return {
      log(message: any, ...options: any[]) {
        log.write(`${formatMsg(message, options)}`)
      },
      warn(message: any, ...options: any[]) {
        if (message instanceof Error) { message = message.stack }
        warn.write(`${formatMsg(message, options)}`)
      },
      error(message: any, ...options: any[]) {
        if (message instanceof Error) { message = message.stack }
        error.write(`${formatMsg(message, options)}`)
      },
    }
  }

  closeWindowLog(name: string) {
    this.openedStream[name].close()
  }

  async setOutputRoot(root: string) {
    this.logRoot = resolve(root, 'logs')
    for (const output of this.outputs) {
      await ensureDir(this.logRoot)
      const name = Reflect.get(output, 'name')
      const logPath = join(this.logRoot, `${name}.log`)
      const stream = createWriteStream(logPath, { encoding: 'utf-8', flags: 'w+' })
      output.pipe(stream)
    }
    this.log(`Set log root to ${root}`)
  }

  async dispose() {
    const mainLogPath = join(this.logRoot, 'main.log')
    if (this.hasError) {
      const zip = new ZipTask(join(this.logRoot, filenamify(new Date().toJSON()) + '.zip'))
      zip.addFile(mainLogPath, 'main.log')
      zip.addFile(mainLogPath, 'main.log')
      await zip.startAndWait()
    }
  }
}
