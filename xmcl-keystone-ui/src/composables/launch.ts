import { DialogKey } from './dialog'
import type { InstanceJavaIssue } from './instanceJavaDiagnose'

export type LaunchStatusParam = {
  isKill?: boolean
  javaIssue?: InstanceJavaIssue
}

export const LaunchStatusDialogKey: DialogKey<LaunchStatusParam> = 'launch-status'
