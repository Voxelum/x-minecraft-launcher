import { MutationKeys, ServiceKey, State } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { join } from 'path'
import { EventEmitter } from 'stream'
import LauncherApp from '../app/LauncherApp'
import { createPromiseSignal, PromiseSignal } from '../util/promiseSignal'

export const PARAMS_SYMBOL = Symbol('service:params')
export const KEYS_SYMBOL = Symbol('service:key')
export const SUBSCRIBE_SYMBOL = Symbol('service:subscribe')

export type ServiceConstructor<T extends AbstractService = AbstractService> = {
  new(...args: any[]): T
}

const STATE_SYMBOL = Symbol('Injected')

export function isState(o: any) {
  return o[STATE_SYMBOL]
}

export function Inject<T extends AbstractService>(con: ServiceConstructor<T>) {
  return (target: object, key: string, index: number) => {
    if (Reflect.has(target, PARAMS_SYMBOL)) {
      // console.log(`Inject ${key} ${index} <- ${target}`)
      Reflect.get(target, PARAMS_SYMBOL)[index] = con
    } else {
      const arr: any[] = []
      Reflect.set(target, PARAMS_SYMBOL, arr)
      arr[index] = con
    }
  }
}

/**
 * Export a service .
 * @param key The service key representing it
 */
export function ExportService<T extends AbstractService>(key: ServiceKey<T>) {
  return (target: ServiceConstructor<T>) => {
    Reflect.set(target, KEYS_SYMBOL, key)
  }
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
      if (!Reflect.has(target, SUBSCRIBE_SYMBOL)) {
        Reflect.set(target, SUBSCRIBE_SYMBOL, [])
      }
      const sub = Reflect.get(target, SUBSCRIBE_SYMBOL) as any[]
      sub.push({ mutations: keys, handler: descriptor.value })
    }
  }
}

export type MutexSerializer<T extends AbstractService> = (this: T, ...params: any[]) => string | string[]

export function ReadLock<T extends AbstractService>(key: (string | string[] | MutexSerializer<T>)) {
  return function (target: T, propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as Function
    descriptor.value = function readLockDecorator(this: T, ...args: any[]) {
      const keyOrKeys = typeof key === 'function' ? key.call(target, ...args) : key
      const keys = keyOrKeys instanceof Array ? keyOrKeys : [keyOrKeys]
      const promises: Promise<() => void>[] = []
      for (const k of keys) {
        const key = k
        const lock = this.semaphoreManager.getLock(key)
        promises.push(lock.acquireRead())
      }
      this.log(`Acquire read locks: ${keys.join(', ')}`)
      const exec = () => {
        try {
          const result = method.apply(this, args)
          if (result instanceof Promise) {
            return result
          } else {
            return Promise.resolve(result)
          }
        } catch (e) {
          return Promise.reject(e)
        }
      }
      Object.defineProperty(exec, 'name', { value: `${method.name}$ReadLock$exec` })
      return Promise.all(promises).then((releases) => {
        return exec().finally(() => {
          this.log(`Release read locks: ${keys.join(', ')}`)
          releases.forEach(f => f())
        })
      })
    }
    Object.defineProperty(descriptor.value, 'name', { value: `${method.name}$ReadLock` })
  }
}

/**
 * A service method decorator to make sure this service will acquire mutex to run, ensuring the mutual exclusive.
 */
export function Lock<T extends AbstractService>(key: (string | string[] | MutexSerializer<T>)) {
  return function (target: T, propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as Function
    descriptor.value = function lockDecorated(this: T, ...args: any[]) {
      const keyOrKeys = typeof key === 'function' ? key.call(target, ...args) : key
      const keys = keyOrKeys instanceof Array ? keyOrKeys : [keyOrKeys]
      const promises: Promise<() => void>[] = []
      for (const key of keys) {
        const lock = this.semaphoreManager.getLock(key)
        promises.push(lock.acquireWrite())
      }
      this.log(`Acquire locks: ${keys.join(', ')}`)
      const exec = () => {
        try {
          const result = method.apply(this, args)
          if (result instanceof Promise) {
            return result
          } else {
            return Promise.resolve(result)
          }
        } catch (e) {
          return Promise.reject(e)
        }
      }
      Object.defineProperty(exec, 'name', { value: `${method.name}$Lock$exec` })
      return Promise.all(promises).then((releases) => {
        return exec().finally(() => {
          this.log(`Release locks: ${keys.join(', ')}`)
          releases.forEach(f => f())
        })
      })
    }
    Object.defineProperty(descriptor.value, 'name', { value: `${method.name}$Lock` })
  }
}

export type ParamSerializer<T extends AbstractService> = (...params: any[]) => string | undefined

export const IGNORE_PARAMS: ParamSerializer<any> = () => ''

export const ALL_PARAMS: ParamSerializer<any> = (...pararms) => JSON.stringify(pararms)

const InstanceSymbol = Symbol('InstanceSymbol')

/**
 * A service method decorator to make sure this service call should run in singleton -- no second call at the time.
 * The later call will wait the first call end and return the first call result.
 */
export function Singleton<T extends AbstractService>(param: ParamSerializer<T> = IGNORE_PARAMS) {
  return function (target: T, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!Reflect.has(target, InstanceSymbol)) {
      Object.defineProperty(target, InstanceSymbol, { value: {} })
    }
    const method = descriptor.value as Function
    const instances: Record<string, Promise<any> | undefined> = Reflect.get(target, InstanceSymbol)
    descriptor.value = function (this: T, ...args: any[]) {
      const targetKey = `${propertyKey}(${param.call(this, ...args)})`
      const exec = () => {
        try {
          const result = method.apply(this, args)
          if (result instanceof Promise) {
            return result
          } else {
            return Promise.resolve(result)
          }
        } catch (e) {
          return Promise.reject(e)
        }
      }
      Object.defineProperty(exec, 'name', { value: `${method.name}$Singleton$exec` })
      const last = instances[targetKey]
      if (last) {
        return last
      } else {
        this.log(`Acquire singleton ${targetKey}`)
        this.up(targetKey)

        instances[targetKey] = exec().finally(() => {
          this.log(`Release singleton ${targetKey}`)
          this.down(targetKey)
          delete instances[targetKey]
        })
        return instances[targetKey]
      }
    }
    Object.defineProperty(descriptor.value, 'name', { value: `${method.name}$Singleton` })
  }
}

/**
 * The base class of a service.
 *
 * The service is a stateful object has life cycle. It will be created when the launcher program start, and destroied
 */
export default abstract class AbstractService extends EventEmitter {
  readonly name: string

  private initializeSignal: PromiseSignal<void> | undefined

  constructor(readonly app: LauncherApp, private initializer?: () => Promise<void>) {
    super()
    this.name = Object.getPrototypeOf(this).constructor.name
  }

  get networkManager() { return this.app.networkManager }

  get serviceManager() { return this.app.serviceManager }

  get taskManager() { return this.app.taskManager }

  get logManager() { return this.app.logManager }

  get storeManager() { return this.app.serviceStateManager }

  get credentialManager() { return this.app.credentialManager }

  get workerManager() { return this.app.workerManager }

  get semaphoreManager() { return this.app.semaphoreManager }

  emit(event: string, ...args: any[]): boolean {
    this.app.broadcast('service-event', { service: this.name, event, args })
    return super.emit(event, ...args)
  }

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
   * Return the path under the config root
   */
  protected getAppDataPath: (...args: string[]) => string = (...args) => join(this.app.appDataPath, ...args)

  /**
   * Return the path under the temp root
   */
  protected getTempPath: (...args: string[]) => string = (...args) => join(this.app.temporaryPath, ...args)

  /**
   * Return the path under game libraries/assets root
   */
  protected getPath: (...args: string[]) => string = (...args) => join(this.app.gameDataPath, ...args)

  /**
   * Return the path under .minecraft folder
   */
  protected getMinecraftPath: (...args: string[]) => string = (...args) => join(this.app.minecraftDataPath, ...args)

  /**
   * The path of .minecraft
   */
  protected get minecraftPath() { return this.app.minecraftDataPath }

  /**
   * If the service does not initialize yet, it will load and wait the service initialization.
   *
   * If the service already initialized or initializing, it will wait the service initialization end.
   */
  async initialize(): Promise<void> {
    if (!this.initializeSignal) {
      this.initializeSignal = createPromiseSignal()
      if (this.initializer) {
        this.initializeSignal.accept(this.initializer())
      } else {
        this.initializeSignal.resolve()
      }
    }
    await this.initializeSignal.promise
  }

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

  protected up(key: string) {
    this.semaphoreManager.acquire(key)
  }

  protected down(key: string) {
    this.semaphoreManager.release(key)
  }
}

export abstract class StatefulService<M extends State<M>> extends AbstractService {
  state: M

  constructor(app: LauncherApp, initializer?: () => Promise<void>) {
    super(app, initializer)
    const state = this.createState()
    Object.defineProperty(state, STATE_SYMBOL, { value: true })
    this.state = app.serviceStateManager.register(this.name, state)
  }

  abstract createState(): M
}
