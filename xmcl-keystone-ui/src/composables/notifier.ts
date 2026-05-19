import { inject, InjectionKey, provide, Ref, ref } from 'vue'

export type Level = 'success' | 'info' | 'warning' | 'error'
export const kNotificationQueue: InjectionKey<Ref<Array<LocalNotification>>> = Symbol('NotifierQueue')

export interface LocalNotification {
  level?: Level
  icon?: string
  title: string
  body?: string
  /**
   * Custom dedupe key. When two notifications share the same key the second one
   * is merged into the first instead of being queued separately — this prevents
   * "notification storms" where the same underlying failure (a broken zip read,
   * a 429 burst, …) fires N times in a row and the user is forced to dismiss
   * every single toast.
   *
   * If not supplied, an automatic key derived from `level + title + body` is
   * used. Pass `null` to opt out of dedupe entirely (e.g. progress-style
   * "started/finished" notifications that legitimately repeat).
   */
  key?: string | null
  /**
   * Number of times this notification has been merged. The renderer shows a
   * "× N" badge when this exceeds 1. Always set internally by the notifier;
   * callers should not set this themselves.
   */
  count?: number
  more?(): void
  operations?: Array<{
    text: string
    icon?: string
    color?: string
    handler(): void
  }>
}
export type Notify = (notification: LocalNotification) => void
export type SubscribeOptions = {
  level: Level | ((err?: any, result?: any) => Level)
  title: string | ((err?: any, result?: any) => string)
}

export function useNotificationQueue() {
  return ref([] as LocalNotification[])
}

/** Cap the queue so a storm of repeating-but-non-mergeable errors cannot
 * grow it without bound (which would also be a memory leak). */
const MAX_QUEUE_LENGTH = 50

export function getNotificationKey(n: LocalNotification): string | null {
  if (n.key === null) return null
  return n.key ?? `${n.level ?? ''}|${n.title}|${n.body ?? ''}`
}

export function useNotifier(queue = inject(kNotificationQueue)) {
  if (!queue) throw new Error('Cannot init notifier hook!')

  const notify: Notify = (not) => {
    const key = getNotificationKey(not)
    if (key !== null) {
      // Merge into an existing pending notification with the same key, if any.
      const existing = queue.value.find((e) => getNotificationKey(e) === key)
      if (existing) {
        existing.count = (existing.count ?? 1) + 1
        return
      }
    }
    if (queue.value.length >= MAX_QUEUE_LENGTH) {
      // Drop the oldest pending entry to make room. Reaching the cap means
      // either dedupe is opted out *and* the renderer is far behind — losing
      // the oldest is better than unbounded growth.
      queue.value.shift()
    }
    queue.value.push({ ...not, count: 1 })
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
    watcherTask,
  }
}
