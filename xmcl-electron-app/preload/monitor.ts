import { LaunchServiceKey } from '@xmcl/runtime-api'
import { Monitor } from '@xmcl/runtime-api/monitor'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import './controller'
import './service'

const emitter = new EventEmitter()

ipcRenderer.on('service-event', (_, { service, event, args }) => {
  if (service === LaunchServiceKey) {
    emitter.emit(event, ...args)
  }
})

const monitor: Monitor = {
  on(event, func) {
    emitter.on(event, func)
  },
}

contextBridge.exposeInMainWorld('gameMonitor', monitor)
