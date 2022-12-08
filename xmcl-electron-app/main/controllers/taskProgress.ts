import Controller from '@/Controller'
import { darkIcon } from '@/utils/icons'
import { app, Notification } from 'electron'
import { ControllerPlugin } from './plugin'

/**
 * Setup task progress bar
 */
export const taskProgressPlugin: ControllerPlugin = function (this: Controller) {
  const notify = (type: 'finish' | 'fail') => {
    const t = this.i18n.t
    if (this.activeWindow && this.activeWindow.isFocused()) {
      // this.activeWindow.webContents.send('notification', n)
    } else if ((type === 'finish' || type === 'fail')) {
      const notification = new Notification({
        title: type === 'finish' ? t('task.success') : t('task.fail'),
        body: t('task.continue'),
        icon: darkIcon,
      })
      notification.show()
      notification.on('click', () => {
        if (this.activeWindow?.isVisible()) {
          this.activeWindow.focus()
        } else {
          this.activeWindow?.show()
        }
      })
    } else {
      // this.app.broadcast('notification', n)
    }
  }
  this.app.once('engine-ready', () => {
    const tasks = this.app.taskManager
    tasks.emitter.on('update', (uid, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          const progress = task.progress / task.total
          if (Number.isNaN(progress) || progress > 1) {
            this.activeWindow.setProgressBar(-1)
          } else {
            this.activeWindow.setProgressBar(progress)
          }
        }
      }
    })
    tasks.emitter.on('success', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        notify('finish')
      }
    })
    tasks.emitter.on('fail', (_, task) => {
      if (tasks.getActiveTask() === task) {
        if (this.activeWindow && !this.activeWindow.isDestroyed()) {
          this.activeWindow.setProgressBar(-1)
        }
        notify('fail')
      }
    })
  })
}
