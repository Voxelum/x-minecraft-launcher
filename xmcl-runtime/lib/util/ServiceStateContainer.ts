import EventEmitter from 'events'
import { AnyError } from './error'

/**
 * The util class to hold each service state snapshot
 */
export class ServiceStateContainer {
  /**
   * The number of reference to this state
   */
  #ref = 0

  constructor(
    readonly id: string,
    readonly state: any,
    readonly emitter: EventEmitter,
    readonly dispose: () => void,
  ) {
  }

  ref() {
    this.#ref++
  }

  deref() {
    this.#ref--
    if (this.#ref <= 0) {
      this.dispose()
      return true
    }
    return false
  }

  commit(type: string, payload: any) {
    if (typeof this.state[type] !== 'function') {
      throw new AnyError('StateError', `Cannot find mutation named ${type} in service ${this.id}`)
    } else {
      this.state[type](payload)
    }
  }
}
