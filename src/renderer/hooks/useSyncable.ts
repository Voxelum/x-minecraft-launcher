import { InjectionKey, ref } from '@vue/composition-api'
import { MutationPayload, Store } from 'vuex'

export const SYNCABLE_KEY: InjectionKey<ReturnType<typeof useSyncable>> = Symbol("Syncable")

export function useSyncable(store: Store<any>) {
  let lastId = 0
  let syncingQueue: { [id: string]: MutationPayload } = {}

  const syncing = ref(false)

  function sync() {
    syncing.value = true

    console.log('Request main process to sync')
    return serviceChannel.sync(lastId).then((syncInfo) => {
      if (!syncInfo) return
      const {
        state,
        length,
      } = syncInfo
      console.log(`Synced ${length} commits.`)

      store.commit('sync', state)
      lastId = length
      syncing.value = false

      syncingQueue = {}
      // ipcRenderer.emit('synced')
    })
  }

  serviceChannel.on('commit', ({ mutation, id }) => {
    if (syncing.value) {
      syncingQueue[id] = mutation
      return
    }
    const newId = lastId + 1
    if (id !== newId) {
      console.log(`Sync conflict from main. Last id in renderer: ${lastId}. Sync from main ${id}`)
      sync()
    } else {
      store.commit(mutation.type, mutation.payload)
      lastId = newId
    }
  })

  return { sync, syncing }
}
