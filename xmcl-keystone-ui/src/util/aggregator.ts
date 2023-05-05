import debounce from 'lodash.debounce'

export class AggregateExecutor<T, A = T> {
  private queue: T[] = []

  private commit: () => void

  constructor(
    aggregator: Aggregator<T, A>,
    flush: (value: A) => void,
    timeout: number) {
    this.commit = debounce(() => {
      const aggregated = aggregator(this.queue)
      this.queue = []
      flush(aggregated)
    }, timeout)
  }

  push(value: T) {
    this.queue.push(value)
    this.commit()
  }
}

export interface Aggregator<T, A = T> {
  (values: T[]): A
}
