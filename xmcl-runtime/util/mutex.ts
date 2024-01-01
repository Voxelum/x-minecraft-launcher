export enum LockStatus {
  Idle,
  Reading,
  Writing,
}

export interface SemaphoreListener {
  (delta: number, semaphore: number): void
}

export type Ticket = () => void

export class Queue {
  private queue: Array<[Promise<void>, () => void]> = []

  async waitInline(): Promise<Ticket> {
    let _resolve: () => void
    const promise = new Promise<void>((resolve) => {
      _resolve = resolve
    })
    // last guy in queue
    const last: Promise<void> | undefined = this.queue[this.queue.length - 1]?.[0]
    // reserve your place in line
    this.queue.push([promise, _resolve!])
    // wait last guy to finish
    await last
    // now my turn
    return () => {
      // call next to execute
      this.queue.shift()?.[1]()
    }
  }

  /**
   * Is queue waiting
   */
  isWaiting() {
    return this.queue.length > 0
  }

  /**
   * Wait the queue is empty
   */
  async waitUntilEmpty() {
    await this.queue[this.queue.length - 1]?.[0]
  }
}
