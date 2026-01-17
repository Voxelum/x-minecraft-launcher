import { Task } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export type TaskEventType = 'update' | 'start' | 'success' | 'fail' | 'pause' | 'cancel' | 'resume'
export type TaskInstance<T extends Task> = T & {
  controller: AbortController
  wrap: (p: Promise<any>) => Promise<any>
  complete: () => void
  fail: (error: unknown) => void
}

export const kTasks: InjectionKey<Tasks> = Symbol('kTasks')

export interface Tasks {
  /**
   * Get the currently active task
   */
  getActiveTask(): TaskInstance<any> | undefined

  /**
   * Create and track a task
   */
  create<T extends Task>(
    task: Omit<T, 'id' | 'progress' | 'substate' | 'state' | 'error'>,
  ): TaskInstance<T>
}
