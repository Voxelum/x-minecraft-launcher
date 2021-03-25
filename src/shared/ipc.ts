import { MutationPayload } from 'vuex'
import { BuiltinNotification } from './entities/notification'
import { TaskBatchPayload, TaskPayload } from './task'

export interface IPCActions {
  'service-call': (service: string, key: string, payload: any) => Promise<string>
  session: (sessionId: number) => Promise<any>
  sync: (id: number) => Promise<{ state: any; length: number }>
  commit: (type: string, payload: any) => Promise<void>
  'task-subscribe': (push?: boolean) => Promise<TaskPayload[]>
  'task-unsubscribe': () => Promise<void>
  'task-operation': (option: { type: 'pause' | 'resume' | 'cancel'; id: string }) => Promise<void>
}

export type Fn = (...args: any[]) => any

export interface ActionInvoker<T> {
  invoke<K extends keyof T>(channel: K, ...args: T[K] extends Fn ? Parameters<T[K]> : never): ReturnType<T[K] extends Fn ? T[K] : never>
}
export interface MainActionHandler<T> {
  handle<K extends keyof T>(channel: K, handler: (...args: T[K] extends Fn ? Parameters<T[K]> : never) => ReturnType<T[K] extends Fn ? T[K] : never>): this
}

/**
 * The events are boardcast from main process to renderer process
 */
export interface IPCEvents {
  'commit': [MutationPayload, number]
  'minecraft-window-ready': void
  'minecraft-start': void
  'minecraft-exit': { code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }
  'minecraft-stdout': string
  'minecraft-stderr': string
  'notification': BuiltinNotification
  'task-update': TaskBatchPayload
  'aquire': string[] | string
  'release': string[] | string
}

export interface RendererEventHandler<E> {
  on<K extends keyof IPCEvents>(event: K, handler: (event: E, ...args: (IPCEvents[K] extends Array<any> ? IPCEvents[K] : [IPCEvents[K]])) => void): this
}
