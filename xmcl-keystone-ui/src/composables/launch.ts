import { DialogKey } from './dialog'

export type LaunchStatusParam = {
  isKill?: boolean
  javaIssue?: 'invalid' | 'incompatible' | undefined
}

export const LaunchStatusDialogKey: DialogKey<LaunchStatusParam> = 'launch-status'
