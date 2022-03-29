import { useI18n } from '../../../composables'
import { PingServerException, BuiltinNotification, TaskNotification, TaskLifeCyclePayload } from '@xmcl/runtime-api'
import { computed, inject, InjectionKey, onMounted, onUnmounted, provide, reactive, Ref, ref, toRefs, watch } from '@vue/composition-api'
import { useDialog } from './useDialog'

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

export function useNotificationHandler() {
  const { $t } = useI18n()
  const { show: showTask } = useDialog('task')
  interface Handler<T extends BuiltinNotification> {
    level: Level
    title(notification: T): string
    body(notification: T): string
    more?(): void
    full?: boolean
  }
  const registry: Record<string, Handler<any> | undefined> = {}

  function register<T extends BuiltinNotification>(type: BuiltinNotification['type'], handler: Handler<T>) {
    registry[type] = handler
  }

  register<TaskNotification>('taskStart', {
    level: 'info',
    title: (n) => $t('task.start', { name: $t(n.name, n.arguments) }),
    body: (n) => $t('task.startBody', { name: $t(n.name) }),
    more: showTask,
    full: true,
  })
  register<TaskNotification>('taskFinish', {
    level: 'success',
    title: (n) => $t(n.name, n.arguments),
    body: (n) => $t('task.finishBody', { name: $t(n.name) }),
    more: showTask,
  })
  register<TaskNotification>('taskFail', {
    level: 'error',
    title: (n) => $t(n.name, n.arguments),
    body: (n) => $t('task.failBody', { name: $t(n.name) }),
    more: showTask,
  })
  register<PingServerException>('pingServerTimeout', {
    level: 'error',
    title: () => $t('profile.server.status.timeout'),
    body: (e) => `${e.host}:${e.port}`,
  })
  register<PingServerException>('pingServerNotFound', {
    level: 'error',
    title: () => $t('profile.server.status.nohost'),
    body: (e) => `${e.host}:${e.port}`,
  })
  register<PingServerException>('pingServerRefused', {
    level: 'error',
    title: () => $t('profile.server.status.refuse'),
    body: (e) => `${e.host}:${e.port}`,
  })

  return registry
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

export function useNotifyQueueConsumer() {
  const data = reactive({
    show: false,
    level: 'info' as Level,
    title: '',
    body: '',
    more: (() => { }) as ((() => void) | undefined),
    full: false,
  })
  const registry = useNotificationHandler()
  const refs = toRefs(data)
  const queue = useNotificationQueue()
  const queueLength = computed(() => queue.value.length)

  function consume() {
    const not = queue.value.pop()
    if (not) {
      data.level = not.level
      data.title = not.title
      data.full = not.full ?? false
      data.show = true
      data.more = not.more
    }
  }

  watch(queueLength, (newLength, oldLength) => {
    if (newLength > oldLength && !data.show) {
      consume()
    }
  })

  // function handleNotification(payload: TaskLifeCyclePayload) {
  //   const handler = registry[payload.type]
  //   if (handler) {
  //     queue.value.push({ level: handler.level, title: handler.title(payload), more: handler.more, full: handler.full })
  //   } else {
  //     console.warn(`Cannot handle the notification ${payload.type}`)
  //   }
  // }
  onMounted(() => {
    // taskMonitor.on('task-start', handleNotification)
    // ipc.on('notification', handleNotification)
  })
  onUnmounted(() => {
    // ipc.removeListener('notification', handleNotification)
  })

  return {
    ...refs,
  }
}

export function useNotifier() {
  const queue = inject(NOTIFY_QUEUE_SYMBOL)
  if (!queue) throw new Error('Cannot init notifier hook!')

  const notify: Notify = (not) => {
    queue.value.push(not)
  }

  // const subscribe = <T>(promise: Promise<T>, success?: (r: T) => LocalNotification, failed?: (e: any) => LocalNotification) => {
  //     promise.then((r) => {
  //         if (success) {
  //             let options = success(r);
  //         }
  //     }, (e) => {
  //         if (failed) {
  //             let options = failed(e);
  //             if (typeof options === 'string') {
  //                 notify('error', options);
  //             } else {
  //                 notify('error', options[0], options[1]);
  //             }
  //         }
  //     });
  // };

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
