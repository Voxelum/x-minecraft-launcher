import { PassThrough, Transform, pipeline } from 'stream'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { filterSensitiveData } from '../util/complaince'
import { format } from 'util'
import { join, resolve } from 'path'
import { WriteStream, createWriteStream, ensureDir } from 'fs-extra'
import { IS_DEV } from '../constant'
import { kLogRoot } from '../entities/log'
import { isSystemError } from '../util/error'

function formatMsg(message: any, options: any[]) { return options.length !== 0 ? format(message, ...options.map(filterSensitiveData)) : format(message) }
function baseTransform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}`) } }) }

function getMessageFromError(e: Error): string {
  let message = e.stack ?? e.message
  if (e instanceof AggregateError) {
    message = e.errors.map(getMessageFromError).join('\n')
  }
  if (e.cause && e.cause instanceof Error) {
    return `${message}\nCaused by: ${getMessageFromError(e.cause)}`
  }
  return message
}

class LogSink {
  readonly entries = { log: baseTransform('INFO'), warn: baseTransform('WARN'), error: baseTransform('ERROR') }

  private stream: WriteStream | undefined
  private passthrough: PassThrough

  constructor(readonly name: string) {
    this.passthrough = new PassThrough({ transform(chunk, encode, cb) { cb(undefined, chunk + '\n') } })
    this.entries.log.pipe(this.passthrough)
    this.entries.warn.pipe(this.passthrough)
    this.entries.error.pipe(this.passthrough)
  }

  init(root: string) {
    this.stream = createWriteStream(join(root, this.name + '.log'), { encoding: 'utf-8', flags: 'w+' })
    this.passthrough.pipe(this.stream)
  }

  dispose() {
    this.stream?.close()
  }
}

export const pluginLogConsumer: LauncherAppPlugin = (app) => {
  const sinks: Record<string, LogSink> = {}

  const main = new LogSink('main')
  sinks.main = main

  const logRoot = resolve(app.appDataPath, 'logs')
  const logger = app.getLogger('LogConsumer')

  app.logEmitter.on('info', (destination, tag, message, ...args) => {
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
    }
    sinks[destination].entries.log.write(`[${tag}] ${formatMsg(message, args)}`)
  })
  app.logEmitter.on('warn', (destination, tag, message, ...args) => {
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
    }
    sinks[destination].entries.warn.write(`[${tag}] ${formatMsg(message, args)}`)
  })
  app.logEmitter.on('failure', (destination, tag, e) => {
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
    }
    sinks[destination].entries.error.write(`[${tag}] ${getMessageFromError(e)}`)
  })

  process.on('uncaughtException', (err) => {
    logger.warn('Uncaught Exception')
    logger.error(err)
  })
  process.on('unhandledRejection', (reason) => {
    logger.warn('Uncaught Rejection')
    logger.warn(reason)
  })

  if (IS_DEV) {
    let pipeIsBroken = false
    const capturePipeError = (f: (...args: any[]) => void) => (...args: any[]) => {
      try {
        f(...args)
      } catch (e) {
        if (isSystemError(e)) {
          if (e.code === 'EPIPE') {
            pipeIsBroken = true
          }
        }
      }
    }
    main.entries.log.on('data', capturePipeError((b) => {
      if (pipeIsBroken) { return }
      console.log(b.toString())
    }))
    main.entries.warn.on('data', capturePipeError((b) => {
      if (pipeIsBroken) { return }
      console.warn(b.toString())
    }))
    main.entries.error.on('data', capturePipeError((b) => {
      if (pipeIsBroken) { return }
      console.error(b.toString())
    }))
  }

  const init = async () => {
    await ensureDir(logRoot)
    for (const destination of Object.values(sinks)) {
      destination.init(logRoot)
    }
    logger.log(`Set log root to ${logRoot}`)
    app.registry.register(kLogRoot, logRoot)
  }

  init()

  app.registryDisposer(async () => {
    for (const destination of Object.values(sinks)) {
      destination.dispose()
    }
  })
}
