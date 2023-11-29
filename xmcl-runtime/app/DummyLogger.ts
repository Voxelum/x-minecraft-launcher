import { LogEmitter } from './LauncherApp'

export function createDummyLogger(tag: string, destination: string, logEmitter: LogEmitter) {
  return {
    log: (message: any, ...options: any[]) => {
      logEmitter.emit('info', destination, tag, message, ...options)
    },
    warn: (message: any, ...options: any[]) => {
      logEmitter.emit('warn', destination, tag, message, ...options)
    },
    error: (e: Error, scope?: string) => {
      logEmitter.emit('failure', destination, scope ?? tag, e)
    },
  }
}
