import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import { LoggerWindowAPI } from '@xmcl/runtime-api/logger'
import { createController } from './controller'

const emitter = new EventEmitter()

ipcRenderer.on('service-event', (_, { service, event, args }) => {
  if (service === 'LaunchService') {
    emitter.emit(event, ...args)
  }
})

const logger: LoggerWindowAPI = {
  on(event, func) {
    emitter.on(event, func)
  },
}

contextBridge.exposeInMainWorld('controllerChannel', createController())
contextBridge.exposeInMainWorld('logger', logger)
