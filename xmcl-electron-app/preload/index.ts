import { contextBridge } from 'electron'
import { createController } from './controller'
import { createSemaphoreChannel } from './semaphore'
import { createServiceChannel } from './service'
import { createTaskChannel } from './task'

contextBridge.exposeInMainWorld('serviceChannel', createServiceChannel())
contextBridge.exposeInMainWorld('semaphoreChannel', createSemaphoreChannel())
contextBridge.exposeInMainWorld('taskChannel', createTaskChannel())
contextBridge.exposeInMainWorld('controllerChannel', createController())
