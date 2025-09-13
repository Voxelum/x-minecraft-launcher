import { Exception } from '@xmcl/runtime-api'
import { errors } from 'undici'
import { format } from 'util'
import { InjectionKey } from '~/app'

export interface Logger {
  log(message: any, ...options: any[]): void
  warn(message: any, ...options: any[]): void
  error(error: Error, scope?: string): void
}
