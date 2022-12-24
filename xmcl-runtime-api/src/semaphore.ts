import { GenericEventEmitter } from './events'

interface SemaphoreChannelEventMap {
  acquire: [string[] | string, number]
  release: [string[] | string, number]
}

/**
 * The resource monitor can monitor what semaphore/resource is up/down. So it can show what resource is busy in UI.
 */
export interface ResourceMonitor extends GenericEventEmitter<SemaphoreChannelEventMap> {
  /**
   * Subscribe the resource/semaphore update. This will make this object start to emit event
   */
  subscribe(): Promise<[Record<string, number>, number]>
  /**
   * Stop subscribe the resource/semaphore update.
   */
  unsubscribe(): Promise<void>
  /**
   * Abort an semaphore, so unlock the loading state
   */
  abort(key: string): Promise<void>
}
