import Controller from '@/Controller'
import { TaskNotification } from '@xmcl/runtime-api'
import { Notification } from 'electron'
import iconPath from '../assets/apple-touch-icon.png'
import { ControllerPlugin } from './plugin'

/**
 * Setup task progress bar
 */
export const taskProgressPlugin: ControllerPlugin = function (this: Controller) {
  const notify = (n: TaskNotification) => {
    const $t = this.i18n.t
    if (this.activeWindow && this.activeWindow.isFocused()) {
      this.activeWindow.webContents.send('notification', n)
    } else if ((n.type === 'taskFinish' || n.type === 'taskFail')) {
      const notification = new Notification({
        title: n.type === 'taskFinish' ? $t('task.success') : $t('task.fail'),
        body: $t('task.continue'),
        icon: iconPath,
      })
      notification.show()
      notification.on('click', () => {
        if (this.activeWindow?.isVisible()) {
          this.activeWindow.focus()
        } else {
          // eslint-disable-next-line no-unused-expressions
          this.activeWindow?.show()
        }
      })
    } else {
      this.app.broadcast('notification', n)
    }
  }
  this.app.once('engine-ready', () => {
    const tasks = this.app.taskManager
    tasks.emitter.on('update', (uid, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(task.progress / task.total)
        }
      }
    })
    tasks.emitter.on('success', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        notify({ type: 'taskFinish', name: task.path, arguments: task.param })
      }
    })
    tasks.emitter.on('fail', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        notify({ type: 'taskFail', name: task.path, arguments: task.param })
      }
    })
  })
}
