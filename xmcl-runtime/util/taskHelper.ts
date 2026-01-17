import { Tracker } from '@xmcl/installer'
import { Task } from '@xmcl/runtime-api'

export function getTracker<E extends object>(task: Task) {
  const tracker: Tracker<E> =  (e) => {
    const payload = e.payload as any
    const progress = payload.progress
    if (progress) {
      // @ts-ignore
      delete payload.progress
    }
    task.substate = { type: e.phase, ...payload }
    task.progress = progress as any
  }
  return tracker
}
