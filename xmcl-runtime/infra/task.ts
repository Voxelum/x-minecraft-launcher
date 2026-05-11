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

export type TaskActivatedListener = (active: boolean) => void

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

  /**
   * Snapshot of all tracked tasks (live + recently-finished, until cleared).
   * Consumed by `TaskService.getTasks()` for the renderer poll loop.
   */
  getAll(): TaskInstance<any>[]

  /**
   * Drop finished (succeed / failed / cancelled) tasks from the tracked list.
   */
  clear(): void

  /**
   * Subscribe to "is anything currently running" transitions. Fires only
   * on the boolean edge — not on each progress tick.
   */
  on(event: 'activated', listener: TaskActivatedListener): this
  off(event: 'activated', listener: TaskActivatedListener): this
}
