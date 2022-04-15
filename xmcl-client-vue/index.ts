import { StateOfService, ServiceChannel, CurseForgeServiceKey, CurseforgeState, InstallServiceKey, InstallState, InstanceIOServiceKey, InstanceModsServiceKey, InstanceModsState, InstanceServiceKey, InstanceState, LaunchServiceKey, LaunchState, UserServiceKey, UserState, VersionServiceKey, VersionState, ServiceKey } from '@xmcl/runtime-api'
import { computed, toRaw } from '@vue/reactivity'

export type StateProxy<T> = T & { sync(): Promise<void> }

export function createServiceProxy<T>(channel: ServiceChannel<T>, initialState?: () => StateOfService<T>): T & { sync(): Promise<void> } {
  const reactiveState = initialState?.() as any || {}
  const createSync = () => {
    let lastId = 0
    let syncingQueue: { [id: string]: { type: string; payload: any } } = {}

    channel.on('commit', ({ mutation, id }) => {
      // if (this.store.state[`services/${service}`].syncing) {
      //   syncingQueue[id] = mutation
      //   return
      // }
      const newId = lastId + 1
      if (id !== newId) {
        console.log(`Sync conflict from main. Last id in renderer: ${lastId}. Sync from main ${id}`)
        sync()
      } else {
        reactiveState[mutation.type](mutation.payload)
        lastId = newId
      }
    })
    const sync = async () => {
      await channel.sync(lastId).then((syncInfo) => {
        if (!syncInfo) {
          console.log(`The ${channel.key} is not syncable.`)
          return
        }
        const { state, length } = syncInfo
        console.log(`Synced ${length} commits for ${channel.key}.`)

        Object.assign(reactiveState, state)
        reactiveState.sync?.(state)
        lastId = length

        syncingQueue = {}
      })
    }

    return sync
  }
  const sync = createSync()
  const callCache: Record<string | symbol, any> = {}
  const service: Record<string, any> = new Proxy({}, {
    get(o, key, r) {
      if (key === 'state') return reactiveState
      if (key === 'on') return channel.on
      if (key === 'once') return channel.once
      if (key === 'removeListener') return channel.removeListener
      if (key === 'sync') return sync
      const cache = callCache[key]
      if (cache) {
        return cache
      }
      const func = async (payload: any) => {
        try {
          return await channel.call(key as any, payload)
        } catch (e) {
          console.error(`Fail to call ${channel.key}.${key.toString()}`)
          throw e
        }
      }
      callCache[key] = func
      return func
    },
  })
  sync()
  return service as any
}

function convert(o: object) {
  const props = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(o))
  const state: any = { ...o }
  for (const [key, prop] of Object.entries(props)) {
    if (prop.get) { state[key] = computed(prop.get.bind(state)) } else if (key !== 'constructor') {
      state[key] = prop.value
    }
  }
  return state
}

const cache: Record<any, any> = {}

export function useService<T>(key: ServiceKey<T>): T {
  const cached = cache[key as any]
  if (cached) {
    return cached
  }
  const prox = createServiceProxy(serviceChannels.open(key))
  cache[key as any] = prox
  return prox
}
