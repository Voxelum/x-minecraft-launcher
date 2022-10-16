import { inject, InjectionKey, provide, Ref, ref } from '@vue/composition-api'

export type Level = 'success' | 'info' | 'warning' | 'error'
const NOTIFY_QUEUE_SYMBOL: InjectionKey<Ref<Array<LocalNotification>>> = Symbol('NotifierQueue')

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
  const queue = inject(NOTIFY_QUEUE_SYMBOL)
  if (!queue) throw new Error()
  return queue
}

export function provideNotifier() {
  const queue = ref([] as LocalNotification[])

  provide(NOTIFY_QUEUE_SYMBOL, queue)

  return { queue }
}

export function useNotifier() {
  const queue = inject(NOTIFY_QUEUE_SYMBOL)
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
