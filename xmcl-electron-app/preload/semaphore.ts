import { ResourceMonitor as ISemaphoreChannel } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import { EventEmitter } from 'events'

function createResourceMonitor(): ISemaphoreChannel {
  const emitter = new EventEmitter()
  ipcRenderer.on('release', (event, semaphores) => {
    emitter.emit('release', semaphores)
  })
  ipcRenderer.on('acquire', (event, semaphores) => {
    emitter.emit('acquire', semaphores)
  })
  return {
    subscribe(): Promise<Record<string, number>> {
      return ipcRenderer.invoke('semaphore')
    },
    unsubscribe(): Promise<void> {
      return Promise.resolve()
    },
    on(channel, listener) {
      emitter.on(channel, listener)
      return this
    },
    once(channel, listener) {
      emitter.once(channel, listener)
      return this
    },
    removeListener(channel, listener) {
      emitter.removeListener(channel, listener)
      return this
    },
  }
}

contextBridge.exposeInMainWorld('resourceMonitor', createResourceMonitor())
