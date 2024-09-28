import { MutableState, ServiceKey, State } from '@xmcl/runtime-api'
import { Client, LauncherApp } from '~/app'
import { Logger } from '~/logger'
import { AnyError } from '~/util/error'
import { ServiceStateContainer, ServiceStateFactory } from './ServiceStateContainer'

export interface ServiceStateContext {
  defineAsyncOperation<T extends (...args: any[]) => Promise<any>>(action: T): T
}

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
    app.controller.handle('unref', ({ sender }, id) => {
      const stateProxy = this.containers[id]
      if (!stateProxy) return 'NOT_STATE_SERVICE'
      stateProxy.untrack(sender)
    })
    app.controller.handle('revalidate', async (_, id, ...args) => {
      await this.revalidate(id, ...args)
    })
    app.registryDisposer(async () => {
      for (const container of Object.values(this.containers)) {
        container.destroy()
      }
    })
  }

  /**
   * Register a static state object to the service state manager. The state object will not be disposed until the app is disposed.
   * @param state The state object
   * @param key The key of the state object
   * @returns The mutable state object
   */
  registerStatic<T>(state: T, key: string | ServiceKey<T>): MutableState<T> {
    const container = new ServiceStateContainer(
      key.toString(),
      this.#unregister,
      { instance: state },
    )

    this.containers[key.toString()] = container

    return state as any
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
    const container = ServiceStateContainer.unwrap(state)
    if (!container) throw new TypeError('Unregistered state!')
    container.track(client)
    return JSON.parse(JSON.stringify(state))
  }

  get<T extends State<T>>(id: string): T | undefined {
    return this.containers[id]?.state as any
  }

  async #revalidate(container: ServiceStateContainer) {
    await container.revalidate().catch((e) => {
      this.logger.error(new AnyError('RevalidateError', `Fail to revalidate ${container.id}`, { cause: e }, { id: container.id }))
    })
  }

  async revalidate(id: string, ...args: any[]) {
    const container = this.containers[id]
    if (!container) return
    await this.#revalidate(container)
  }

  async registerOrGet<T extends State<T>>(id: string, factory: ServiceStateFactory<T>): Promise<MutableState<T>> {
    if (this.containers[id]) {
      const container = this.containers[id]
      await this.#revalidate(container)
      return await container.promise
    }

    const container = new ServiceStateContainer<T>(
      id,
      this.#unregister,
      { factory },
    )

    this.containers[id] = container

    container.promise.then(() => {
      this.app.emit('service-state-init', id)
    }, () => { })

    return await container.promise
  }

  #unregister = (id: string) => {
    delete this.containers[id]
  }
}
