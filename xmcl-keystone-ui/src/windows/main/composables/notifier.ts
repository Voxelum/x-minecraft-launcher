import { inject, InjectionKey, provide, Ref, ref } from 'vue'

export type Level = 'success' | 'info' | 'warning' | 'error'
export const kNotificationQueue: InjectionKey<Ref<Array<LocalNotification>>> = Symbol('NotifierQueue')

export interface LocalNotification {
  level: Level
  title: string
  body?: string
  more?(): void
  full?: boolean
}
export type Notify = (notification: LocalNotification) => void
export type SubscribeOptions = {
  level: Level | ((err?: any, result?: any) => Level)
  title: string | ((err?: any, result?: any) => string)
}

export function useNotificationQueue() {
  return ref([] as LocalNotification[])
}

export function useNotifier() {
  const queue = inject(kNotificationQueue)
  if (!queue) throw new Error('Cannot init notifier hook!')

  const notify: Notify = (not) => {
    queue.value.push(not)
  }

  const subscribeTask = <T>(promise: Promise<T>, title: string, more?: () => void) => {
    promise.then(() => {
      notify({ level: 'success', title, more })
    }, () => {
      notify({ level: 'error', title, more })
    })
  }

  const watcherTask = <T>(
    func: () => Promise<T>,
    title: string,
    more?: () => void,
  ) => () => subscribeTask(func(), title, more)

  return {
    notify,
    subscribeTask,
    // subscribe,
    // watcher,
    watcherTask,
  }
}
