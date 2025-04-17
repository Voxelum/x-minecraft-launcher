import { format } from 'util'
import { filterSensitiveData } from './complaince'
import { InjectionKey } from '~/app'
import { Exception } from '@xmcl/runtime-api'

export const kLogRoot: InjectionKey<string> = Symbol('LogRoot')

export interface Logger {
  log(message: any, ...options: any[]): void
  warn(message: any, ...options: any[]): void
  error(error: Error, scope?: string): void
}

export function formatLogMessage(message: any, options: any[]) { return options.length !== 0 ? format(message, ...options.map(filterSensitiveData)) : format(message) }

export function getMessageFromError(e: Error): string {
  if (!e.message && e instanceof Exception) {
    e.message = JSON.stringify(e.exception)
  }
  let message = e.stack ?? e.message
  if (e instanceof AggregateError) {
    message = e.errors.map(getMessageFromError).join('\n')
  }
  if (e.cause && e.cause instanceof Error) {
    return `${message}\nCaused by: ${getMessageFromError(e.cause)}`
  }
  return message
}
