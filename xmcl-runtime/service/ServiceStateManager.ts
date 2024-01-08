import { MutableState, ServiceKey, State } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { Client, LauncherApp } from '~/app'
import { Logger } from '~/logger'
import { AnyError } from '~/util/error'
import { getServiceKey } from './Service'
import { ServiceStateContainer } from './ServiceStateContainer'
import { MutableStateImpl, kStateKey } from './stateUtils'

const kStateContainer = Symbol('StateContainer')

export class ServiceStateManager {
  private logger: Logger

  private containers: Record<string, ServiceStateContainer> = {}

  constructor(private app: LauncherApp) {
    this.logger = this.app.getLogger('ServiceStateManager')
    app.controller.handle('commit', (event, id, type, payload) => {
      const stateProxy = this.containers[id]
      if (!stateProxy) return 'NOT_STATE_SERVICE'
      try {
        stateProxy.commit(type, payload)
      } catch (e) {
        this.logger.error(e as any)
      }
    })
    app.controller.handle('deref', (_, id) => {
      const stateProxy = this.containers[id]
      if (!stateProxy) return 'NOT_STATE_SERVICE'
      if (stateProxy.deref()) {
        delete this.containers[id]
      }
    })
    app.controller.handle('revalidate', (_, id) => {
      this.revalidate(id)
    })
    app.registryDisposer(async () => {
      for (const container of Object.values(this.containers)) {
        container.dispose()
      }
    })
  }

  registerStatic<T>(v: T, key: string | ServiceKey<T>): MutableState<T> {
    const _state = this.register(key.toString(), (v as any), () => { })
    this.ref(_state)
    this.app.registryDisposer(async () => {
      this.deref(_state)
    })
    return _state
  }

  /**
   * Serialize the state object to the client. The client will receive the state object and its mutations.
   *
   * This will add the client to state tracking list. When there is no client connected, the state tracking code will be disposed.
   *
   * @param client The client to track the state
   * @param state
   */
  serializeAndTrack<T>(client: Client, state: MutableState<T>) {
    const container = (state as any)[kStateContainer] as ServiceStateContainer
    if (!container) throw new TypeError('Unregistered state!')
    container.ref()
    const handler = (type: any, payload: any) => {
      client.send('commit', container.id, type, payload)
    }
    state.subscribeAll(handler)
    const onDestroyed = () => {
      state.unsubscribeAll(handler)
      if (container.deref()) {
        delete this.containers[container.id]
      }
    }
    container.addDisposeListener(() => {
      client.removeListener('destroyed', onDestroyed)
    })
    client.on('destroyed', onDestroyed)
    return JSON.parse(JSON.stringify(state))
  }

  /**
   * Statically ref the state. The state will not be disposed until the process exit.
   * @param state The state to ref
   */
  ref<T>(state: MutableState<T>) {
    const container = (state as any)[kStateContainer] as ServiceStateContainer
    if (!container) throw new TypeError('Unregistered state!')
    container.ref()
  }

  /**
   * Statically deref the state. The state will be disposed if there is no reference to it.
   * @param state The state to deref
   */
  deref<T>(state: MutableState<T>) {
    const container = (state as any)[kStateContainer] as ServiceStateContainer
    if (!container) throw new TypeError('Unregistered state!')
    if (container.deref()) {
      delete this.containers[container.id]
    }
  }

  /**
   * Register the state object to the service manager. Let other services to observe this state mutations.
   * @param id The id of the state
   * @param state The state object
   * @param dispose The dispose function to release the state resource
   */
  register<T extends State<T>>(id: string, state: T, dispose: () => void, revalidator?: () => Promise<void>): MutableState<T> {
    const emitter = new EventEmitter()
    const container = new ServiceStateContainer(
      id,
      state,
      emitter,
      dispose,
      revalidator,
    )

    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(state)))) {
      if (key !== 'constructor' && prop.value instanceof Function) {
        // decorate original mutation
        const func = prop.value.bind(state)
        Reflect.set(state, key, function (this: any, value: any) {
          func(value)
          emitter.emit(key, value)
          emitter.emit('*', key, value)
        })
      }
    }

    this.containers[id] = container
    Object.defineProperties(state, {
      [kStateKey]: { value: Object.getPrototypeOf(state).constructor.name, enumerable: true, configurable: false },
      [kStateContainer]: { value: container, enumerable: false, configurable: false },
    })
    const parent = new MutableStateImpl(emitter)
    Object.setPrototypeOf(Object.getPrototypeOf(state), parent)
    return Object.assign(state, {
      id,
      revalidate: () => revalidator?.(),
    }) as MutableState<T>
  }

  get<T extends State<T>>(id: string): T | undefined {
    return this.containers[id]?.state
  }

  async revalidate(id: string) {
    const container = this.containers[id]
    if (!container) return
    await container.revalidator?.().catch((e) => {
      this.logger.error(new AnyError('RevalidateError', `Fail to revalidate ${id}`, { cause: e }, { id }))
    })
  }

  async registerOrGet<T extends State<T>>(id: string, supplier: (onDestroy: () => void) => Promise<[T, () => void] | [T, () => void, () => Promise<void>]>): Promise<MutableState<T>> {
    if (this.containers[id]) {
      const container = this.containers[id]
      await container.revalidator?.().catch((e) => {
        this.logger.error(new AnyError('RevalidateError', `Fail to revalidate ${id}`, { cause: e }, { id }))
      })
      return container.state
    }
    const onDestroy = () => {
      while (this.containers[id] && !this.containers[id].deref()) { /* empty */ }
      delete this.containers[id]
    }
    const result = await supplier(onDestroy)
    return this.register(id, result[0], result[1], result[2])
  }
}
