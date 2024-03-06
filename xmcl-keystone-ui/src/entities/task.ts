import type { TaskState } from '@xmcl/runtime-api'

/**
 * The task item represent a task on UI or a sub task
 */
export interface TaskItem {
  /**
   * The unique id of this task node
   */
  id: string

  /**
    * The task root id
    */
  taskId: string

  /**
   * The reactive children
   */
  children: TaskItem[] | undefined
  /**
   * The non-reactive children reference
   */
  rawChildren: TaskItem[] | undefined
  /**
   * Is children dirty
   */
  childrenDirty: boolean

  time: Date

  path: string
  param: Record<string, any>
  message: object | string
  total: number
  progress: number

  state: TaskState
  throughput: number

  parentId?: number
}
