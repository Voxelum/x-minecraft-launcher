import debounce from 'lodash.debounce'

export class AggregateExecutor<T, A = T> {
  private queue: T[] = []

  private commit: () => void

  constructor(
    private aggregator: Aggregator<T, A>,
    private _flush: (value: A) => void,
    timeout: number) {
    this.commit = debounce(() => {
      const aggregated = aggregator(this.queue)
      this.queue = []
      _flush(aggregated)
    }, timeout)
  }

  flush() {
    const aggregated = this.aggregator(this.queue)
    this.queue = []
    return this._flush(aggregated)
  }

  push(value: T) {
    this.queue.push(value)
    this.commit()
  }
}

export interface Aggregator<T, A = T> {
  (values: T[]): A
}
