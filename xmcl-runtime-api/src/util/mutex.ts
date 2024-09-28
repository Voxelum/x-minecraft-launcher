import { PromiseSignal, createPromiseSignal } from './promiseSignal'

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
  #queue: Array<[() => Promise<any>, PromiseSignal<any>, boolean]> = []
  #free: PromiseSignal<any>[] = []
  private status: LockStatus = LockStatus.Idle
  /**
   * The integer representing number of worker is occuping the lock.
   * - For the read operation, it can be as many as possible.
   * - For the write operation, it can only be 1.
   */
  private semaphore = 0

  constructor(private listener?: SemaphoreListener) { }

  async #processOperation<T>(operation: () => Promise<T>, signal: PromiseSignal<T>, isRead: boolean) {
    try {
      this.status = isRead ? LockStatus.Reading : LockStatus.Writing
      this.#up()
      const result = await operation()
      signal.resolve(result)
    } catch (e) {
      signal.reject(e)
    } finally {
      this.#down()
      if (this.semaphore === 0) {
        this.status = LockStatus.Idle
        this.#processIfIdle()
      }
    }
  }

  async #processIfIdle() {
    if (this.status === LockStatus.Idle) {
      while (this.#queue.length > 0) {
        const [operation, signal, isRead] = this.#queue.shift()!
        this.#processOperation(operation, signal, isRead)
        const thisIsWrite = !isRead
        const isNextWrite = !(this.#queue[0]?.[2] ?? true)
        if (thisIsWrite || isNextWrite) {
          // Wait write if next is write or current is writing
          await signal.promise.catch(() => { })
          while (this.#free.length > 0) {
            // Wait all read operation to finish
            const freeRead = this.#free.shift()!
            await freeRead.promise.catch(() => { })
          }
        }
      }
    }
  }

  #up() {
    this.semaphore += 1
    this.listener?.(1, this.semaphore)
  }

  #down() {
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
    const signal = createPromiseSignal<T>()
    if (this.status === LockStatus.Reading) {
      this.#free.push(signal)
      this.#processOperation(operation, signal, true)
      return signal.promise
    }

    this.#queue.push([operation, signal, true])
    this.#processIfIdle()
    return signal.promise
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
  write<T>(operation: () => Promise<T>): Promise<T> {
    const signal = createPromiseSignal<T>()
    this.#queue.push([operation, signal, false])
    this.#processIfIdle()
    return signal.promise
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
