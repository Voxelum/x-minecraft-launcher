import {
  ProgressTracker,
  ProgressTrackerMultiple,
  ProgressTrackerSingle,
} from '@xmcl/file-transfer'

type TrackEvent<T extends object> = {
  [K in keyof T]: { phase: K; payload: T[K] }
}[keyof T]

export interface Tracker<T extends object> {
  <E extends TrackEvent<T>>(event: E): void
}

export interface AnyTracker extends Tracker<any> {}

export type Raw<T extends object> = T
export type WithDownload<T extends object> = T & { progress: ProgressTracker }
export type WithProgress<T extends object> = T & { progress: { progress: number; total: number } }

export function onState<T extends object, K extends keyof T>(
  tracker: Tracker<T> | undefined,
  phase: K,
  payload: T[K],
): void {
  tracker?.({ phase, payload } as any)
}

export function onProgress<T extends object, K extends keyof T>(
  tracker: Tracker<T> | undefined,
  phase: K,
  payload: Omit<T[K], 'progress'>,
): { progress: number; total: number } {
  const single = { progress: 0, total: 0 }
  tracker?.({ phase, payload: { ...payload, progress: single } } as any)
  return single
}

export function onDownloadMultiple<T extends object, K extends keyof T>(
  tracker: Tracker<T> | undefined,
  phase: K,
  payload: Omit<T[K], 'progress'>,
): ProgressTrackerMultiple {
  const parent = new ProgressTrackerMultiple()
  tracker?.({ phase, payload: { ...payload, progress: parent } } as any)
  return parent
}

export function onDownloadSingle<T extends object, K extends keyof T>(
  tracker: Tracker<T> | undefined,
  phase: K,
  payload: Omit<T[K], 'progress'>,
): ProgressTrackerSingle {
  const single = new ProgressTrackerSingle()
  tracker?.({ phase, payload: { ...payload, progress: single } } as any)
  return single
}
