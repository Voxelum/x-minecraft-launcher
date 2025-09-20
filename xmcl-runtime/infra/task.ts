import { Task } from '@xmcl/task'
import { EventEmitter } from 'events'
import { InjectionKey } from '~/app'

export type TaskEventType = 'update' | 'start' | 'success' | 'fail' | 'pause' | 'cancel' | 'resume'

export const kTaskExecutor: InjectionKey<TaskFn> = Symbol('kTaskExecutor')
export const kTasks: InjectionKey<{
  submit: TaskFn
  emitter: TaskEventEmitter
  getActiveTask: () => Task<any> | undefined
}> = Symbol('kTasks')

export type TaskFn = <T>(task: Task<T>) => Promise<T>

export interface TaskEventEmitter extends EventEmitter {
  on(event: 'update', handler: (uuid: string, task: Task<any>, chunkSize: number) => void): this
  on(event: 'fail', handler: (uuid: string, task: Task<any>, error: any) => void): this
  on(event: TaskEventType, handler: (uuid: string, task: Task<any>) => void): this

  emit(event: 'update', uuid: string, task: Task<any>, chunkSize: number): boolean
  emit(event: 'fail', uuid: string, task: Task<any>, error: any): boolean
  emit(event: TaskEventType, uuid: string, task: Task<any>): boolean
}
