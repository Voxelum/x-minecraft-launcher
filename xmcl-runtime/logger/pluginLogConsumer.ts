import filenamify from 'filenamify'
import { WriteStream, createWriteStream, ensureDir, readFile, readdir, stat, unlink } from 'fs-extra'
import { basename, join, resolve } from 'path'
import { PassThrough, Transform } from 'stream'
import { LauncherAppPlugin } from '~/app'
import { IS_DEV } from '../constant'
import { isSystemError } from '../util/error'
import { ZipTask } from '../util/zip'
import { formatLogMessage, getMessageFromError, kLogRoot } from './logger'

function baseTransform(tag: string) { return new Transform({ transform(c, e, cb) { cb(undefined, `[${tag}] [${new Date().toLocaleString()}] ${c}`) } }) }

class LogSink {
  readonly entries = { log: baseTransform('INFO'), warn: baseTransform('WARN'), error: baseTransform('ERROR') }

  private stream: WriteStream | undefined
  private passthrough: PassThrough
  path: string | undefined

  constructor(readonly name: string) {
    this.passthrough = new PassThrough({ transform(chunk, encode, cb) { cb(undefined, chunk + '\n') } })
    this.entries.log.pipe(this.passthrough)
    this.entries.warn.pipe(this.passthrough)
    this.entries.error.pipe(this.passthrough)
  }

  init(root: string) {
    this.path = join(root, this.name + '.log')
    this.stream = createWriteStream(this.path, { encoding: 'utf-8', flags: 'w+' })
    this.passthrough.pipe(this.stream)
  }

  dispose() {
    this.passthrough.end()
    this.passthrough.on('error', () => { /* ignore */ })
    this.stream?.close()
    this.stream?.on('error', () => { /* ignore */ })
  }
}

export const pluginLogConsumer: LauncherAppPlugin = (app) => {
  const sinks: Record<string, LogSink> = {}

  const main = new LogSink('main')
  sinks.main = main

  const logRoot = resolve(app.appDataPath, 'logs')
  const logger = app.getLogger('LogConsumer')

  let hasError = false
  app.logEmitter.on('info', (destination, tag, message, ...args) => {
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
      if (initialized) {
        sinks[destination].init(logRoot)
      }
    }
    sinks[destination].entries.log.write(`[${tag}] ${formatLogMessage(message, args)}`)
  })
  app.logEmitter.on('warn', (destination, tag, message, ...args) => {
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
      if (initialized) {
        sinks[destination].init(logRoot)
      }
    }
    sinks[destination].entries.warn.write(`[${tag}] ${formatLogMessage(message, args)}`)
  })
  app.logEmitter.on('failure', (destination, tag, e) => {
    hasError = true
    if (!sinks[destination]) {
      sinks[destination] = new LogSink(destination)
      if (initialized) {
        sinks[destination].init(logRoot)
      }
    }
    sinks[destination].entries.error.write(`[${tag}] ${getMessageFromError(e)}`)
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

  setTimeout(async () => {
    // remove the zips older than a week
    const root = logRoot!
    const files = await readdir(root)
    const zips = files.filter(f => f.endsWith('.zip'))
    const check = async (path: string) => {
      const fstat = await stat(path)
      if (Date.now() - fstat.mtime.getTime() > 7 * 24 * 60 * 60 * 1000) {
        await unlink(path)
      }
    }
    for (const file of zips) {
      const path = join(root, file)
      check(path)
    }
  }, 60 * 1000)

  let initialized = false
  const init = async () => {
    await ensureDir(logRoot)
    for (const destination of Object.values(sinks)) {
      destination.init(logRoot)
    }
    logger.log(`Set log root to ${logRoot}`)
    app.registry.register(kLogRoot, logRoot)
    initialized = true
  }

  init()

  app.registryDisposer(async () => {
    try {
      if (hasError) {
        const zip = new ZipTask(join(logRoot, filenamify(new Date().toJSON()) + '.zip'))
        for (const sink of Object.values(sinks)) {
          zip.addBuffer(await readFile(sink.path!), `logs/${basename(sink.name)}.log`)
        }
        await zip.startAndWait()
      }
    } finally {
      for (const destination of Object.values(sinks)) {
        destination.dispose()
      }
    }
  })
}
