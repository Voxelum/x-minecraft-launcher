export interface ProgressTracker {
  url: string
  total: number
  progress: number
}

export class ProgressTrackerSingle implements ProgressTracker {
  accessor?: ProgressTracker
  expectedTotal = 0
  done = false

  constructor(readonly onDownload?: (accessor: ProgressTracker) => void) {}

  setAccessor(accessor: ProgressTracker) {
    this.accessor = accessor
    this.onDownload?.(accessor)
  }

  get progress() { return this.accessor?.progress ?? 0 }
  get total() { return this.accessor?.total ?? this.expectedTotal }
  get url() { return this.accessor?.url ?? '' }
  toJSON() { return { url: this.url, total: this.total, progress: this.progress } }
}

export class ProgressTrackerMultiple implements ProgressTracker {
  trackers: ProgressTrackerSingle[] = []
  expectedTotal = 0

  subSingle() {
    const single = new ProgressTrackerSingle()
    this.trackers.push(single)
    return single
  }

  get url() { return this.trackers.find((tracker) => !tracker.done)?.url ?? this.trackers[0]?.url ?? '' }
  get total() {
    return Math.max(this.expectedTotal, this.trackers.reduce((total, tracker) => total + tracker.total, 0))
  }
  get progress() {
    return this.trackers.reduce((progress, tracker) => progress + tracker.progress, 0)
  }
  toJSON() { return { url: this.url, total: this.total, progress: this.progress } }
}

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
