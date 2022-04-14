import { ServiceChannel } from '../service'
import { StateOfService } from '../state'

export type StateProxy<T> = T & { sync(): Promise<void> }

export function createServiceProxy<T>(channel: ServiceChannel<T>, initialState?: () => StateOfService<T>): T & { sync(): Promise<void> } {
  const reactiveState = initialState?.() as any
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
  const service: Record<string, any> = new Proxy({
  }, {
    get(o, key, r) {
      if (key === 'state') return reactiveState
      if (key === 'on') return channel.on
      if (key === 'once') return channel.once
      if (key === 'removeListener') return channel.removeListener
      if (key === 'sync') return sync
      return async (payload: any) => {
        try {
          console.log(payload)
          return await channel.call(key as any, payload)
        } catch (e) {
          console.error(`Fail to call ${channel.key}.${key as any}`)
          throw e
        }
      }
    },
  })
  sync()
  return service as any
}
