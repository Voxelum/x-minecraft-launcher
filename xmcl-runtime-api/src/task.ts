import { GenericEventEmitter } from './events'

export enum TaskState {
  Idle,
  Running,
  Cancelled,
  Paused,
  Succeed,
  Failed,
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
/**
 * The full payload represent a task
 */
export interface TaskPayload extends TaskPayloadBase {
  path: string
  from: string
  to: string
  param: object
  children: TaskPayload[]
  progress: number
  total: number
  state: TaskState
  error?: object
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
    * The task un-localized name
    */
  path: string
  /**
    * The task un-localized name param
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

  error?: object

  progress?: number

  total?: number

  chunkSize?: number

  state?: TaskState
}

export interface TaskBatchUpdatePayloads {
  readonly adds: TaskAddedPayload[]
  readonly updates: TaskUpdatePayload[]
}

interface TaskChannelEventMap {
  'task-update': TaskBatchUpdatePayloads
}

export interface TaskLifeCyclePayload {
  name: string // the task path
  arguments?: Record<string, unknown>
}

/**
 * The monitor to watch launcher task progress
 */
export interface TaskMonitor extends GenericEventEmitter<TaskChannelEventMap> {
  /**
   * Start subscribe the task status. Once this is called, the task event will start to emit from this object.
   */
  subscribe(): Promise<TaskPayload[]>
  /**
   * Un-subscribe the task event.
   */
  unsubscribe(): Promise<void>
  /**
   * Pause a task
   * @param taskId The task id to be paused
   */
  pause(taskId: string): Promise<void>
  /**
   * Resume a paused task
   * @param taskId The task id to be resumed
   */
  resume(taskId: string): Promise<void>
  /**
   * Cancel a task
   * @param taskId The task id to be cancelled
   */
  cancel(taskId: string): Promise<void>
}
