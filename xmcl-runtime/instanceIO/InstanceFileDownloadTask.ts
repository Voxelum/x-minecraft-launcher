import { AbortSignal, download, DownloadOptions } from '@xmcl/file-transfer'
import { InstanceFile } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { errors } from 'undici'

export class InstanceFileDownloadTask extends AbortableTask<void> {
  constructor(readonly options: Array<{ options: DownloadOptions; file: InstanceFile }>,
    readonly finished: Set<InstanceFile> = new Set(),
  ) {
    super()
    this.name = 'file'
  }

  protected abort: (isCancelled: boolean) => void = () => { }

  protected async process(): Promise<void> {
    const totals = new Array(this.options.length).fill(0)
    const progresses = new Array(this.options.length).fill(0)
    const listeners: Array<() => void> = []
    const aborted = () => this.isCancelled || this.isPaused
    const signal: AbortSignal = {
      get aborted() { return aborted() },
      addEventListener(event, listener) {
        if (event !== 'abort') {
          return this
        }
        listeners.push(listener)
        return this
      },
      removeEventListener(event, listener) {
        // noop as this will be auto gc
        return this
      },
    }
    this.abort = () => {
      listeners.forEach((l) => l())
    }
    await Promise.allSettled(this.options.map(async ({ options, file }, i) => {
      await download({
        ...options,
        abortSignal: signal,
        progressController: {
          progress: 0,
          onProgress: (url, chunkSize, written, total) => {
            progresses[i] = written
            totals[i] = total
            this._progress = progresses.reduce((a, b) => a + b, 0)
            this._total = totals.reduce((a, b) => a + b, 0)
            this._from = url.toString()
            this.update(chunkSize)
          },
        },
      })
      this.finished.add(file)
    }))
  }

  protected isAbortedError(e: any): boolean {
    if (e instanceof errors.RequestAbortedError || e.code === 'UND_ERR_ABORTED') {
      return true
    }
    return false
  }
}
