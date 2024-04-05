import { createPromiseSignal, getServiceSemaphoreKey, MutableState, PromiseSignal, ServiceKey, State } from '@xmcl/runtime-api'
import { join } from 'path'
import { EventEmitter } from 'stream'
import { Logger } from '~/logger'
import { LauncherApp } from '../app/LauncherApp'
import { AnyError } from '../util/error'

export type ServiceConstructor<T extends AbstractService = AbstractService> = {
  new(...args: any[]): T
}

export type MutexSerializer<T extends AbstractService> = (this: T, ...params: any[]) => string | string[]

export type ParamSerializer<T extends AbstractService> = (...params: any[]) => string | undefined

export const IGNORE_PARAMS: ParamSerializer<any> = () => ''

export const ALL_PARAMS: ParamSerializer<any> = (...pararms) => JSON.stringify(pararms)

const InstanceSymbol = Symbol('InstanceSymbol')

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
    const instances: Record<string, Promise<any> | undefined> = Reflect.get(target, InstanceSymbol) as any
    descriptor.value = function (this: T, ...args: any[]) {
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
      const serviceKey = getServiceKey(Object.getPrototypeOf(this).constructor)
      Object.defineProperty(exec, 'name', { value: `${method.name}$Singleton$exec` })
      const targetKey = getServiceSemaphoreKey(serviceKey, propertyKey, param.call(this, ...args))
      const last = instances[targetKey]
      if (last) {
        return last
      } else {
        this.log(`Acquire singleton ${targetKey}`)
        this.up(targetKey)

        const startTime = Date.now()
        instances[targetKey] = exec().finally(() => {
          const endTime = Date.now()
          this.log(`Release singleton ${targetKey}. Took ${endTime - startTime}ms.`)
          this.down(targetKey)
          delete instances[targetKey]
        })
        return instances[targetKey]
      }
    }
    Object.defineProperty(descriptor.value, 'name', { value: `${method.name}$Singleton` })
  }
}

export function ExposeServiceKey<T extends Function>(key: ServiceKey<T>) {
  return function (target: T) {
    Reflect.set(target, 'ServiceKey', key)
  }
}

export function getServiceKey<T extends Function>(target: T): ServiceKey<T> & string {
  return Reflect.get(target, 'ServiceKey') as any
}

/**
 * The base class of a service.
 *
 * The service is a stateful object has life cycle. It will be created when the launcher program start, and destroied
 */
export abstract class AbstractService extends EventEmitter {
  private initializeSignal: PromiseSignal<void> | undefined
  protected logger: Logger

  constructor(readonly app: LauncherApp, private initializer?: () => Promise<void>) {
    super()
    this.logger = app.getLogger(Object.getPrototypeOf(this).constructor.name)
    this.log = this.logger.log
    this.warn = this.logger.warn
    this.error = this.logger.error
  }

  get semaphoreManager() { return this.app.semaphoreManager }

  emit(event: string, ...args: any[]): boolean {
    this.app.controller.broadcast('service-event', { service: getServiceKey(Object.getPrototypeOf(this).constructor), event, args })
    return super.emit(event, ...args)
  }

  /**
   * Return the path under the config root
   */
  protected getAppDataPath: (...args: string[]) => string = (...args) => join(this.app.appDataPath, ...args)

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
        const startTime = Date.now()
        this.initializeSignal.accept(this.initializer().catch((e) => {
          this.error(new AnyError('ServiceInitializeError', 'Fail to initialize', { cause: e }))
          throw e
        }).finally(() => {
          const endTime = Date.now()
          this.log(`Initialized in ${endTime - startTime}ms.`)
        }))
      } else {
        this.initializeSignal.resolve()
      }
    }
    await this.initializeSignal.promise
  }

  log = (m: any, ...a: any[]) => {
  }

  error = (e: Error) => {
  }

  warn = (m: any, ...a: any[]) => {
  }

  protected up(key: string) {
    this.semaphoreManager.acquire(key)
  }

  protected down(key: string) {
    this.semaphoreManager.release(key)
  }
}

export abstract class StatefulService<M extends State<M>> extends AbstractService {
  state: MutableState<M>

  constructor(app: LauncherApp, createState: () => MutableState<M>, initializer?: () => Promise<void>) {
    super(app, initializer)
    this.state = createState()
  }
}
