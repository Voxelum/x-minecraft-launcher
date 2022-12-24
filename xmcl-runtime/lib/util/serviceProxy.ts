import EventEmitter from 'events'
import { LauncherApp } from '../app/LauncherApp'
import { isState } from '../services/Service'
import { Logger } from './log'

/**
 * The util class to hold each service state snapshot
 */
export class ServiceStateProxy {
  /**
  * The total order of the current store state.
  * One commit will make this id increment by one.
  */
  private checkPointId = 0

  private snapshot: any

  constructor(
    readonly app: LauncherApp,
    readonly eventBus: EventEmitter,
    readonly serviceName: string,
    readonly state: any,
    private logger: Logger,
  ) {
    const stateKeys = [] as string[]

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(state)))) {
      if (key !== 'constructor' && prop.value instanceof Function) {
        const original = prop.value
        function wrapped(this: any, value: any) {
          original.call(this, value)
          // increment the checkpoint
          self.checkPointId += 1
          // broadcast commit event to client
          app.controller.broadcast('commit', serviceName, { mutation: { type: key, payload: value }, id: self.checkPointId })
          // broadcast mutation to mutation subscriber
          eventBus.emit(key, value)
        }
        // decorate original mutation
        Reflect.set(state, key, wrapped)
      }
    }
    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(state))) {
      if (!prop.get) {
        if (prop.value) {
          if (!isState(prop.value)) {
            stateKeys.push(key)
          }
        } else {
          stateKeys.push(key)
        }
      }
    }

    // the snapshot stub object
    this.snapshot = {
      toJSON() {
        const obj = {} as any
        for (const key of stateKeys) {
          obj[key] = (state as any)[key]
        }
        return obj
      },
    }
  }

  takeSnapshot(currentId: number) {
    const checkPointId = this.checkPointId
    this.logger.log(`Sync from renderer: ${currentId}, service ${this.serviceName}: ${checkPointId}.`)
    return {
      state: JSON.parse(JSON.stringify(this.snapshot)),
      length: checkPointId,
    }
  }

  commit(type: string, payload: any) {
    if (typeof this.state[type] !== 'function') {
      this.logger.error(`Cannot find mutation named ${type} in service ${this.serviceName}`)
    } else {
      this.state[type](payload)
    }
  }
}
