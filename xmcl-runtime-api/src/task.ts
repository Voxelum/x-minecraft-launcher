import { WithDownload } from '@xmcl/installer'
import { GenericEventEmitter } from './events'
import {
  InstallAssetsTask,
  InstallFabricTask,
  InstallForgeTask,
  InstallJavaTask,
  InstallLabyModTask,
  InstallLibrariesTask,
  InstallMinecraftTask,
  InstallNeoForgeTask,
  InstallOptifineTask,
  InstallProfileTask,
  InstallQuiltTask,
  ReinstallTask,
} from './services/InstallService'
import { InstallInstanceTask } from './services/InstanceInstallService'
import { MigrateMinecraftTask } from './services/VersionService'
import { ExportModpackTask } from './services/ModpackService'
import { InstallAuthlibInjectorTask } from './services/AuthlibInjectorService'
import { DownloadModMetadataDbTask } from './services/ModMetadataService'
import { DuplicateInstanceTask } from './services/InstanceService'
import { InstallModrinthFileTask, InstallCurseforgeFileTask } from './services/MarketService'
import { ServiceKey } from './services/Service'

export enum TaskState {
  Running,
  Cancelled,
  Succeed,
  Failed,
}

export type SubState<T, K extends keyof T> = Omit<T[K], 'download' | 'progress'> & { type: K }

export interface SubStateLike {}

export interface DownloadProgress {
  url: string
  total: number
  acceptRanges: boolean
  progress: number
  speed: number
}

export interface CommonProgress {
  total: number
  progress: number
}

export interface Task {
  /**
   * The uuid, each task should be uniquely identified by this.
   */
  id: string
  /**
   * The type of the task
   */
  type: string
  /**
   * The key for identify for the task. Each type targeting same thing should have same key.
   */
  key: string
  /**
   * The sub task/state for this task
   */
  substate: unknown
  /**
   * The current state of the task
   */
  state: TaskState
  /**
   * The error object when the task failed
   */
  error?: object
  /**
   * The progress if applicable
   */
  progress?: DownloadProgress | CommonProgress
}

export interface DownloadUpdateTrackerEvents {
  'download-update.asar': WithDownload<{}>
  'download-update.full': WithDownload<{}>
  'download-update.appx': {}
  'download-update.manual': {}
}

export interface DownloadUpdateTask extends Task {
  type: 'downloaUpdate'
  operation: 'autoupdater' | 'asar' | 'appx' | 'manual'
  version: string
  substate:
    | SubState<DownloadUpdateTrackerEvents, 'download-update.asar'>
    | SubState<DownloadUpdateTrackerEvents, 'download-update.full'>
    | SubState<DownloadUpdateTrackerEvents, 'download-update.appx'>
    | SubState<DownloadUpdateTrackerEvents, 'download-update.manual'>
}

export type Tasks =
  | InstallForgeTask
  | InstallAssetsTask
  | InstallLibrariesTask
  | InstallMinecraftTask
  | InstallNeoForgeTask
  | InstallFabricTask
  | InstallQuiltTask
  | InstallOptifineTask
  | InstallLabyModTask
  | ReinstallTask
  | InstallProfileTask
  | InstallJavaTask
  | DownloadUpdateTask
  | MigrateMinecraftTask
  | InstallInstanceTask
  | ExportModpackTask
  | InstallAuthlibInjectorTask
  | DownloadModMetadataDbTask
  | DuplicateInstanceTask
  | InstallModrinthFileTask
  | InstallCurseforgeFileTask

export function isTask<T extends Tasks>(key: T['type'], task: Tasks): task is T {
  return task.type === key
}

interface TaskServiceEventMap {
  /**
   * Fires when the launcher transitions between "no tasks running" and "at
   * least one task running". The renderer uses this to start/stop its
   * polling loop. The next `getTasks()` snapshot is the source of truth for
   * everything else (added/finished/cancelled), so no per-task lifecycle
   * events are emitted here — that would just create races.
   */
  'task-activated': boolean
}

/**
 * The service to monitor and control launcher background tasks.
 *
 * Note: progress updates are intentionally **poll-based** (`getTasks`).
 * Tasks can update at very high frequency, which would overwhelm an
 * event-sourced `SharedState` channel. The renderer drives the poll
 * cadence and pauses it when `task-activated` is `false`.
 */
export interface TaskService extends GenericEventEmitter<TaskServiceEventMap> {
  /**
   * Snapshot of all live and recently-finished tasks. Renderer polls this.
   */
  getTasks(): Promise<Tasks[]>
  /**
   * Cancel a running task.
   */
  cancel(taskId: string): Promise<void>
  /**
   * Remove all finished (succeed / failed / cancelled) tasks from the list.
   */
  clear(): Promise<void>
}

export const TaskServiceKey: ServiceKey<TaskService> = 'TaskService'
