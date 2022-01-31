import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'
import { TaskMonitor as ITaskChannel, TaskPayload } from '@xmcl/runtime-api'

function createTaskMonitor(): ITaskChannel {
  const emitter = new EventEmitter()

  ipcRenderer.on('task-update', (_, event) => {
    emitter.emit('task-update', event)
  })
  return {
    subscribe(): Promise<TaskPayload[]> {
      return ipcRenderer.invoke('task-subscribe')
    },

    unsubscribe(): Promise<void> {
      return ipcRenderer.invoke('task-unsubscribe')
    },

    pause(taskId: string): Promise<void> {
      return ipcRenderer.invoke('task-operation', { type: 'pause', id: taskId })
    },

    resume(taskId: string): Promise<void> {
      return ipcRenderer.invoke('task-operation', { type: 'resume', id: taskId })
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
  }
}

contextBridge.exposeInMainWorld('taskMonitor', createTaskMonitor())
