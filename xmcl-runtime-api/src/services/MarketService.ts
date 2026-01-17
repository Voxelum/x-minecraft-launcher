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
  substate: SubState<InstallModrinthFileTrackerEvents, 'download'>
}

export interface InstallCurseforgeFileTrackerEvents {
  download: WithDownload<{}>
}

export interface InstallCurseforgeFileTask extends Task {
  type: 'installCurseforgeFile'
  projectId: number
  fileId: number
  substate: SubState<InstallCurseforgeFileTrackerEvents, 'download'>
}
