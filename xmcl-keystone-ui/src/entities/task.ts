import type { TaskState } from '@xmcl/runtime-api'

/**
 * The task item represent a sub task
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

  children: TaskItem[] | undefined

  time: Date

  path: string
  param: object
  title: string
  from: string
  to: string
  message: string
  total: number
  progress: number

  state: TaskState
  throughput: number

  parentId?: number
}
