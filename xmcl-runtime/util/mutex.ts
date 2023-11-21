import { createPromiseSignal } from './promiseSignal'

export enum LockStatus {
  Idle,
  Reading,
  Writing,
}

export interface SemaphoreListener {
  (delta: number, semaphore: number): void
}

/**
 * A simple implementation of read write mutex on a resource. It provide api to acquire the read/write operation on a resource.
 *
 * This ensure all operations accessing the resource by this lock will not violate the mutual exclusion.
 */
export class ReadWriteLock {
  private queue: Array<[() => Promise<void>, (() => void) | undefined]> = []
  private status: LockStatus = LockStatus.Idle
  /**
   * The integer representing number of worker is occuping the lock.
   * - For the read operation, it can be as many as possible.
   * - For the write operation, it can only be 1.
   */
  private semaphore = 0
  /**
   * The handle to release current read lock. Only exist if the status is Reading.
   */
  private release: (() => void) | undefined = undefined

  constructor(private listener?: SemaphoreListener) { }

  private async processIfIdle() {
    if (this.status === LockStatus.Idle) {
      while (this.queue.length > 0) {
        const [operation, release] = this.queue.shift()!
        this.release = release
        this.status = release ? LockStatus.Reading : LockStatus.Writing
        await operation()
      }
      this.status = LockStatus.Idle
    }
  }

  private perform<T>(operation: () => Promise<T>) {
    this.up()
    return operation().finally(() => {
      this.down()
      if (this.semaphore === 0 && this.release) {
        this.release() // release the current read section
      }
    })
  }

  private up() {
    this.semaphore += 1
    this.listener?.(1, this.semaphore)
  }

  private down() {
    this.semaphore -= 1
    this.listener?.(-1, this.semaphore)
  }

  getStatus() {
    return this.status
  }

  /**
   * Submit a read operation to the resource. Once the resource is reading, all read operations can get the lock.
   *
   * The write operation cannot execute if the status is Reading.
   *
   * @param operation The read operation
   */
  async read<T>(operation: () => Promise<T>): Promise<T> {
    if (this.status === LockStatus.Reading) {
      return this.perform(operation)
    }
    return new Promise<T>((resolve, reject) => {
      // the shared read section promise
      const readingPromise = createPromiseSignal()
      const wrapper = () => {
        this.perform(operation).then(resolve, reject)
        return readingPromise.promise
      }
      this.queue.push([wrapper, readingPromise.resolve])
      this.processIfIdle()
    })
  }

  async acquireRead(): Promise<() => void> {
    let start = () => { }
    let end = () => { }
    const startPromise = new Promise<void>((resolve) => {
      start = resolve
    })
    const endPromise = new Promise<void>((resolve) => {
      end = resolve
    })
    this.read(async () => {
      start()
      return endPromise
    })
    await startPromise
    return end
  }

  /**
   * Submit a write operation to the resource. A write operation can only execute if the status is idel.
   * @param operation The write operation.
   */
  async write<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrapper = () => {
        return this.perform(operation).then(resolve, reject)
      }
      this.queue.push([wrapper, undefined])
      this.processIfIdle()
    })
  }

  async acquireWrite() {
    let start = () => { }
    let end = () => { }
    const startPromise = new Promise<void>((resolve) => {
      start = resolve
    })
    const endPromise = new Promise<void>((resolve) => {
      end = resolve
    })
    this.write(async () => {
      start()
      return endPromise
    })
    await startPromise
    return end
  }
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
