export interface ProgressTracker {
  url: string
  total: number
  progress: number
}

export class ProgressTrackerMultiple implements ProgressTracker {
  trackers: ProgressTrackerSingle[] = []
  expectedTotal: number = 0

  subSingle(): ProgressTrackerSingle {
    const single = new ProgressTrackerSingle()
    this.trackers.push(single)
    return single
  }

  get url() {
    for (const t of this.trackers) {
      if (!t.done) {
        return t.url
      }
    }
    return this.trackers[0]?.url ?? ''
  }

  get total() {
    const total = this.trackers.reduce((a, b) => a + b.total, 0)
    return total < this.expectedTotal ? this.expectedTotal : total
  }

  get progress() {
    return this.trackers.reduce((a, b) => a + b.progress, 0)
  }

  toJSON() {
    return {
      url: this.url,
      total: this.total,
      progress: this.progress,
    }
  }
}

/**
 * Track progress of a download
 */
export class ProgressTrackerSingle implements ProgressTracker {
  accessor?: ProgressTracker
  expectedTotal: number = 0

  done = false

  constructor(readonly onDownload?: (accessor: ProgressTracker) => void) {}

  setAccessor(accessor: ProgressTracker) {
    this.accessor = accessor
    try {
      this.onDownload?.(accessor)
    } catch (e) {
      // Prevent callback errors from breaking the download
      console.error('Error in progress callback:', e)
    }
  }

  get progress() {
    return this.accessor?.progress ?? 0
  }

  get total() {
    return this.accessor?.total ?? this.expectedTotal
  }

  get url() {
    return this.accessor?.url ?? ''
  }

  toJSON() {
    return {
      url: this.url,
      total: this.total,
      progress: this.progress,
    }
  }
}
