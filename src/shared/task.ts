export enum TaskState {
  Idel,
  Running,
  Cancelled,
  Paused,
  Successed,
  Failed,
}

export interface TaskPayload extends TaskPayloadBase {
  from: string
  to: string
  path: string
  param: object
  children: TaskPayload[]
  progress: number
  total: number
  state: TaskState
  error?: string
}

export interface TaskPayloadBase {
  /**
     * The uuid of the task root
     */
  uuid: string
  /**
     * The local id of the task
     */
  id: number
  /**
     * The time of the event
     */
  time: number
}

export interface TaskAddedPayload extends TaskPayloadBase {
  /**
     * The task from (src)
     */
  from?: string
  /**
     * The task to (destination)
     */
  to?: string
  /**
     * The task unlocalized name
     */
  path: string
  /**
     * The task unlocalized name param
     */
  param: Record<string, any>

  parentId?: number
}

export interface TaskUpdatePayload extends TaskPayloadBase {
  /**
     * The task from (src)
     */
  from?: string
  /**
     * The task to (destination)
     */
  to?: string

  error?: string

  progress?: number

  total?: number

  chunkSize?: number

  state?: TaskState
}

export interface TaskBatchPayload {
  adds: TaskAddedPayload[]
  updates: TaskUpdatePayload[]
}
