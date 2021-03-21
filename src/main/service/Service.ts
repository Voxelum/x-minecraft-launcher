import { Task } from '@xmcl/task'
import { join } from 'path'
import LauncherApp from '/@main/app/LauncherApp'
import { WaitingQueue } from '/@main/util/mutex'
import { Exceptions } from '/@shared/entities/exception'
import { MutationKeys, RootCommit, RootGetters, RootState } from '/@shared/store'
import 'reflect-metadata'

export const PURE_SYMBOL = Symbol('__pure__')

export type ServiceConstructor = {
  new(...args: any[]): AbstractService;
}

export const registeredServices: ServiceConstructor[] = []

export function Service(target: ServiceConstructor) {
  registeredServices.push(target)
}

/**
 * Fire on certain store mutation committed.
 * @param keys The mutations name
 */
export function Subscribe(...keys: MutationKeys[]) {
  return function (target: AbstractService, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!keys || keys.length === 0) {
      throw new Error('Must listen at least one mutation!')
    } else {
      target.app.storeManager.subscribeAll(keys, descriptor.value)
    }
  }
}

export type KeySerializer = (this: AbstractService, ...params: any[]) => string;

export enum Policy {
  Skip = 'skip',
  Wait = 'wait'
}

const runningSingleton: Record<string, Promise<any>> = {}
const waitingQueue: Record<string, WaitingQueue> = {}

function getQueue(name: string) {
  if (!(name in waitingQueue)) {
    waitingQueue[name] = new WaitingQueue()
  }
  return waitingQueue[name]
}

export function Enqueue(queue: WaitingQueue) {
  return function (target: AbstractService, propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const func = function (this: AbstractService, ...args: any[]) {
      return queue.enqueue(async () => {
        let isPromise = false
        try {
          const result = method.apply(this, args)
          if (result instanceof Promise) {
            isPromise = true
            const promise = result.finally(() => {
              // for (const s of semiphores) {
              //     delete runningSingleton[s];
              // }
              // this.release(semiphores);
            })
            // for (const s of semiphores) {
            //     runningSingleton[s] = promise;
            // }
            return promise
          }
          return result
        } finally {
          if (!isPromise) {
            // this.release(semiphores);
          }
        }
      })
    }
    descriptor.value = func
  }
}

/**
 * A service method decorator to make sure this service call should run in singleton -- no second call at the time.
 * The later call will wait the first call end and return the first call result.
 */
export function Singleton(...keys: (string | KeySerializer)[]) {
  return function (target: AbstractService, propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const func = function (this: AbstractService, ...args: any[]) {
      const semiphores: string[] = [propertyKey, ...keys.map(k => (typeof k === 'string' ? k : k.bind(this)(...args)))]
      if (semiphores.some((key) => this.isBusy(key))) {
        return runningSingleton[semiphores[0]]
      }
      this.aquire(semiphores)
      let isPromise = false
      try {
        const result = method.apply(this, args)
        if (result instanceof Promise) {
          isPromise = true
          const promise = result.finally(() => {
            for (const s of semiphores) {
              delete runningSingleton[s]
            }
            this.release(semiphores)
          })
          for (const s of semiphores) {
            runningSingleton[s] = promise
          }
          return promise
        }
        return result
      } finally {
        if (!isPromise) {
          this.release(semiphores)
        }
      }
    }
    descriptor.value = func
  }
}

export function Pure() {
  return function (target: AbstractService, propertyKey: string, descriptor: PropertyDescriptor) {
    const func = Reflect.get(target, propertyKey)
    Reflect.set(func, PURE_SYMBOL, true)
  }
}

export class ServiceException extends Error {
  constructor(readonly exception: Exceptions, message?: string) {
    super(message)
  }
}

/**
 * The base class of a service.
 *
 * The service is a stateful object has life cycle. It will be created when the launcher program start, and destroied
 */
export default abstract class AbstractService {
  readonly name: string;

  constructor(readonly app: LauncherApp) {
    this.name = Object.getPrototypeOf(this).constructor.name
  }

  get networkManager() { return this.app.networkManager }

  get serviceManager() { return this.app.serviceManager }

  get taskManager() { return this.app.taskManager }

  get logManager() { return this.app.logManager }

  get storeManager() { return this.app.storeManager }

  get credentialManager() { return this.app.credentialManager }

  get workerManager() { return this.app.workerManager }

  get persistManager() { return this.app.persistManager }

  /**
   * Submit a task into the task manager.
   *
   * The lifecycle of the service call will fit with the task life-cycle automatically.
   *
   * @param task
   */
  protected submit<T>(task: Task<T>) {
    return this.taskManager.submit(task)
  }

  /**
   * Get a worker for the code run another thread
   */
  protected worker() {
    return this.workerManager.getWorker()
  }

  /**
   * The managed state
   */
  get state(): RootState { return this.storeManager.store.state }

  /**
   * The managed getter
   */
  get getters(): RootGetters { return this.storeManager.store.getters as any }

  /**
   * The commit method
   */
  get commit(): RootCommit { return this.storeManager.store.commit }

  /**
   * Return the path under the config root
   */
  protected getAppDataPath: (...args: string[]) => string = (...args) => join(this.app.appDataPath, ...args);

  /**
   * Return the path under the temp root
   */
  protected getTempPath: (...args: string[]) => string = (...args) => join(this.app.temporaryPath, ...args);

  /**
   * Return the path under game libraries/assets root
   */
  protected getPath: (...args: string[]) => string = (...args) => join(this.app.gameDataPath, ...args);

  /**
   * Return the path under .minecraft folder
   */
  protected getMinecraftPath: (...args: string[]) => string = (...args) => join(this.app.minecraftDataPath, ...args);

  /**
   * The path of .minecraft
   */
  protected get minecraftPath() { return this.app.minecraftDataPath }

  /**
   * The load the service. It should load the basic data of the server. You cannot access other services from here.
   */
  async initialize(): Promise<void> { }

  async dispose(): Promise<void> { }

  log = (m: any, ...a: any[]) => {
    this.logManager.log(`[${this.name}] ${m}`, ...a)
  }

  error = (m: any, ...a: any[]) => {
    this.logManager.error(`[${this.name}] ${m}`, ...a)
  }

  warn = (m: any, ...a: any[]) => {
    this.logManager.warn(`[${this.name}] ${m}`, ...a)
  }

  protected isBusy(key: string) {
    return this.serviceManager.isBusy(key)
  }

  protected aquire(key: string | string[]) {
    this.serviceManager.aquire(key)
  }

  protected release(key: string | string[]) {
    this.serviceManager.release(key)
  }

  protected pushException(e: Exceptions) {
    this.app.broadcast('notification', e)
  }
}
