import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import { GameOutput } from '@xmcl/runtime-api/logger'
import './controller'

const emitter = new EventEmitter()

ipcRenderer.on('service-event', (_, { service, event, args }) => {
  if (service === 'LaunchService') {
    emitter.emit(event, ...args)
  }
})

const gameOutput: GameOutput = {
  on(event, func) {
    emitter.on(event, func)
  },
}

contextBridge.exposeInMainWorld('gameOutput', gameOutput)
