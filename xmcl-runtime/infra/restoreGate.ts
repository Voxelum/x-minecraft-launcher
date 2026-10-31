import { AsyncLocalStorage } from 'async_hooks'
import type { LauncherApp } from '~/app'

/** App-local exclusion, including direct service calls and shared-state commits. */
export class RestoreGate {
  private blocked = false
  private publishing = false
  private context = new AsyncLocalStorage<{ active: boolean }>()
  private frozen = false
  private operations = new Set<Promise<unknown>>()
  private writers = new Set<RestoreWriter>()

  assertWritable() {
    if (this.blocked && !this.context.getStore()?.active) throw new Error('Restore maintenance is active')
  }

  guardState(state: object, excluded: string[] = []) {
    const prototype = Object.getPrototypeOf(state)
    const keys = new Set([...Object.keys(state), ...(prototype === Object.prototype ? [] : Object.getOwnPropertyNames(prototype))])
    for (const key of keys) {
      if (key === 'constructor' || excluded.includes(key)) continue
      const value = Reflect.get(state, key)
      if (typeof value !== 'function') continue
      if (['subscribe', 'unsubscribe', 'subscribeAll', 'unsubscribeAll', 'revalidate'].includes(key)) continue
      Reflect.set(state, key, (...args: unknown[]) => {
        this.assertWritable()
        return value.apply(state, args)
      })
    }
  }

  guardMethods(target: object, names: string[]) {
    for (const name of names) {
      const method = Reflect.get(target, name)
      if (typeof method !== 'function') throw new TypeError(`Missing restore-guarded method: ${name}`)
      Reflect.set(target, name, (...args: unknown[]) => {
        try { return this.run(() => method.apply(target, args)) } catch (e) { return Promise.reject(e) }
      })
    }
  }

  run<T>(action: () => T): T {
    this.assertWritable()
    const token = { active: true }
    return this.context.run(token, () => {
      try {
        const result = action()
        if (result instanceof Promise) {
          this.operations.add(result)
          const finish = () => { token.active = false; this.operations.delete(result) }
          result.then(finish, finish)
        } else {
          token.active = false
        }
        return result
      } catch (e) { token.active = false; throw e }
    })
  }

  writer(write: () => Promise<void>, delay = 0) {
    const writer = new RestoreWriter(this, write, delay)
    this.writers.add(writer)
    return writer
  }

  get recoveryRequired() { return this.frozen }

  get suppressPersistence() { return this.publishing }

  async enter(check: () => void) {
    if (this.blocked) throw new Error('Restore maintenance is active')
    this.blocked = true
    try {
      check()
      while (this.operations.size) await Promise.allSettled(this.operations)
      check()
      const results = await Promise.allSettled([...this.writers].map(w => w.flush()))
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed) throw failed.reason
    } catch (e) {
      this.blocked = false
      throw e
    }
  }

  publish<T>(action: () => T): T {
    this.publishing = true
    const token = { active: true }
    try { return this.context.run(token, action) } finally { token.active = false; this.publishing = false }
  }

  release(recoveryRequired: boolean) {
    this.frozen = recoveryRequired
    if (!recoveryRequired) this.blocked = false
  }
}

/** One ordered writer: timers never overlap, failures remain visible to drain. */
export class RestoreWriter {
  private timer?: ReturnType<typeof setTimeout>
  private tail: Promise<void> = Promise.resolve()
  private dirty = false
  private failure: unknown

  constructor(private gate: RestoreGate, private write: () => Promise<void>, private delay: number) {}

  schedule() {
    if (this.gate.suppressPersistence) return
    this.gate.assertWritable()
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      // Failure is retained for the explicit maintenance/disposal drain.
      void this.enqueue().catch(() => {})
    }, this.delay)
  }

  private enqueue() {
    if (!this.dirty) return this.tail
    this.dirty = false
    this.tail = this.tail.catch(() => {}).then(this.write).then(() => {
      this.failure = undefined
    }, e => { this.failure = e; throw e })
    return this.tail
  }

  async flush() {
    if (this.gate.recoveryRequired) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    await this.enqueue()
    if (this.failure) throw this.failure
  }
}

const gates = new WeakMap<LauncherApp, RestoreGate>()
export function getRestoreGate(app: LauncherApp) {
  let gate = gates.get(app)
  if (!gate) { gate = new RestoreGate(); gates.set(app, gate) }
  return gate
}
