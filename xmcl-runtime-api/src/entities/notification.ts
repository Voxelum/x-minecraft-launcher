import { Exceptions } from './exception'

export interface NotificationBase {
  type: string
}

export interface TaskNotification extends NotificationBase {
  type: 'taskStart' | 'taskFinish' | 'taskFail'
  name: string // the task path
  arguments?: Record<string, unknown>
}

export type BuiltinNotification = Exceptions | TaskNotification
