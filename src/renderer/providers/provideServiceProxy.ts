import { provide, reactive, ref, Ref, set } from '@vue/composition-api'
import { ipcRenderer, SERVICES_KEY, SERVICES_SEMAPHORE_KEY } from '/@/constant'
import { ServiceKey } from '/@shared/services/Service'

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
  return Reflect.get(promise, '__tasks__')
}

async function startSession(sessionId: number, tasks: Ref<Array<any>>) {
  const listener = (event: any, task: string) => {
    tasks.value.push(task)
  }
  ipcRenderer.on(`session-${sessionId}`, listener)
  const { result, error } = await ipcRenderer.invoke('session', sessionId)
  ipcRenderer.removeListener(`session-${sessionId}`, listener)
  if (error) {
    if (error.errorMessage) {
      error.toString = () => error.errorMessage
    }
    return Promise.reject(error)
  }
  return result
}

export function getServiceProxy<T>(seriv: ServiceKey<T>): T {
  return new Proxy({} as any, {
    get(_, functionName) {
      const func = function (payload: any) {
        const tasks = ref([])
        const promise = ipcRenderer.invoke('service-call', seriv, functionName as string, payload).then((r: any) => {
          if (typeof r !== 'number') {
            throw new Error(`Cannot find service call named ${functionName as string} in ${seriv}`)
          }
          return startSession(r, tasks)
        })
        Object.defineProperty(promise, '__tasks__', { value: tasks, enumerable: false, writable: false, configurable: false })
        return promise
      }
      Object.defineProperty(func, 'name', { value: functionName, enumerable: false, writable: false, configurable: false })
      return func
    },
  })
}

export default function provideServiceProxy() {
  provide(SERVICES_KEY, getServiceProxy as any)
  const semaphore: Record<string, number> = reactive({})
  ipcRenderer.on('aquire', (e, res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in semaphore) {
        semaphore[s] += 1
      } else {
        set(semaphore, s, 1)
      }
    }
  })
  ipcRenderer.on('release', (e, res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in semaphore) {
        semaphore[s] = Math.max(0, semaphore[s] - 1)
      } else {
        set(semaphore, s, 0)
      }
    }
  })
  provide(SERVICES_SEMAPHORE_KEY, semaphore)
  return getServiceProxy
}
