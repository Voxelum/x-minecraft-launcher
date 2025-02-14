import { Migration } from '@xmcl/runtime-api/migration'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import './controller'

const emitter = new EventEmitter()

ipcRenderer.on('migration-event', (_, { event, payload }) => {
  emitter.emit(event, payload)
})

const migration: Migration = {
  on(event, func) {
    emitter.on(event, func)
  },
  getProgress: function (): Promise<{ from: string; to: string; progress: number; total: number }> {
    return ipcRenderer.invoke('migration-get-progress')
  }
}

contextBridge.exposeInMainWorld('migration', migration)
