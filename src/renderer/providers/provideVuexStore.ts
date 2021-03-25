import { provide, set } from '@vue/composition-api'
import storeOption from '/@shared/store'
import Vuex, { Store, MutationPayload } from 'vuex'
import { ipcRenderer, STORE_KEY } from '../constant'

/**
 * provide vuex store for certain modules.
 * @param modules The accept module. If this's empty, it will load all modules
 */
export default function provideVuexStore(...modules: string[]) {
  storeOption.modules = {
    ...storeOption.modules,
  }
  if (modules.length !== 0) {
    for (const m of Object.keys(storeOption.modules)) {
      if (modules.indexOf(m) === -1) {
        delete storeOption.modules[m]
      }
    }
  }
  storeOption.plugins = [
    ...(storeOption.plugins || []),
  ]
  storeOption.mutations!.sync = (state, payload) => {
    const keys = Object.keys(payload)
    for (const k of keys) {
      if (k in state) {
        (state as any)[k] = payload[k]
      } else {
        set(state, k, payload[k])
      }
    }
  }

  const localStore: any = new Vuex.Store(storeOption)
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
      // mutations.forEach(localCommit);
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
      sync()
    } else {
      localCommit(mutation)
      lastId = newId
    }
  })
  sync()

  localStore.commit = (type: string, payload: any) => {
    ipcRenderer.invoke('commit', type, payload)
  }

  provide(STORE_KEY, localStore)

  return localStore as Store<any>
}
