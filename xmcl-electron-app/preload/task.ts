import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import type { TaskMonitor as ITaskChannel, Tasks } from '@xmcl/runtime-api'

function createTaskMonitor(): ITaskChannel {
  const emitter = new EventEmitter()

  ipcRenderer.on('task-activated', (_, event) => {
    emitter.emit('task-activated', event)
  })
  return {
    poll(): Promise<Tasks[]> {
      return ipcRenderer.invoke('task-poll')
    },

    check(): Promise<boolean> {
      return ipcRenderer.invoke('task-check')
    },

    cancel(taskId: string): Promise<void> {
      return ipcRenderer.invoke('task-operation', { type: 'cancel', id: taskId })
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

    clear(): Promise<void> {
      return ipcRenderer.invoke('task-clear')
    },
  }
}

contextBridge.exposeInMainWorld('taskMonitor', createTaskMonitor())
