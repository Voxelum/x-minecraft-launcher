import { provide, set } from '@vue/composition-api'
import Vuex, { MutationPayload, Store } from 'vuex'
import { ipcRenderer, STORE_KEY } from '../constant'

/**
 * Provide vuex store for certain modules.
 */
export default function provideSyncableVuexStore(): Store<any> & { sync(): void } {
  const options = {
    modules: {
    },
    mutations: {
      sync(state: any, payload: any) {
        const keys = Object.keys(payload)
        for (const k of keys) {
          if (k in state) {
            (state as any)[k] = payload[k]
          } else {
            set(state, k, payload[k])
          }
        }
      },
    },
  }

  const store = new Vuex.Store(options)
  const localStore: any = store
  const _commit = localStore.commit
  const localCommit = (mutation: MutationPayload) => {
    if (localStore._mutations[mutation.type]) {
      _commit(mutation.type, mutation.payload)
    } else {
      console.log(`discard commit ${mutation.type}`)
    }
  }

  let lastId = 0
  let syncing = true
  let syncingQueue: { [id: string]: MutationPayload } = {}

  function sync() {
    syncing = true

    ipcRenderer.invoke('sync', lastId).then((syncInfo) => {
      if (!syncInfo) return
      const {
        state,
        length,
      } = syncInfo
      console.log(`Synced ${length} commits.`)
      _commit('sync', state)
      lastId = length
      syncing = false

      const missing = Object.keys(syncingQueue)
        .map(k => Number.parseInt(k, 10))
        .filter(i => i > lastId)
      if (missing.length !== 0) {
        for (const key of missing) {
          console.log(syncingQueue[key])
        }
      }
      syncingQueue = {}
      ipcRenderer.emit('synced')
    })
  }

  ipcRenderer.on('commit', (event, mutation, id) => {
    if (syncing) {
      syncingQueue[id] = mutation
      return
    }
    const newId = lastId + 1
    if (id !== newId) {
      console.log(`Sync conflict from main. Last id in renderer: ${lastId}. Sync from main ${id}`)
      sync()
    } else {
      localCommit(mutation)
      lastId = newId
    }
  })

  localStore.commit = (type: string, payload: any) => {
    ipcRenderer.invoke('commit', type, payload)
  }

  localStore.sync = sync

  provide(STORE_KEY, localStore)

  return localStore
}
