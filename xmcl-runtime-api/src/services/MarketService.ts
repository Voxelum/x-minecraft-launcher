import type { WithDownload } from '@xmcl/installer'
import type { SubState, Task } from '../task'

export interface InstallModrinthFileTrackerEvents {
  download: WithDownload<{}>
}

export interface InstallModrinthFileTask extends Task {
  type: 'installModrinthFile'
  projectId: string
  versionId: string
  filename: string
  icon?: string
  title?: string
  substate: SubState<InstallModrinthFileTrackerEvents, 'download'>
}

export interface InstallCurseforgeFileTrackerEvents {
  download: WithDownload<{}>
}

export interface InstallCurseforgeFileTask extends Task {
  type: 'installCurseforgeFile'
  projectId: number
  fileId: number
  filename?: string
  icon?: string
  title?: string
  substate: SubState<InstallCurseforgeFileTrackerEvents, 'download'>
}
