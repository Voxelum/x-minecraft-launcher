/**
 * The slice of Node's `events` the preload modules use. Aliased in
 * `esbuild.config.ts` so the reused preload code runs in the webview without
 * pulling a Node polyfill bundle into every window.
 */

type Listener = (...args: any[]) => void

export class EventEmitter {
  private readonly channels = new Map<string, Listener[]>()

  addListener(channel: string, listener: Listener) {
    const list = this.channels.get(channel)
    if (list) list.push(listener)
    else this.channels.set(channel, [listener])
    return this
  }

  on(channel: string, listener: Listener) {
    return this.addListener(channel, listener)
  }

  once(channel: string, listener: Listener) {
    const wrapped: Listener = (...args) => {
      this.removeListener(channel, wrapped)
      listener(...args)
    }
    ;(wrapped as Listener & { listener?: Listener }).listener = listener
    return this.addListener(channel, wrapped)
  }

  removeListener(channel: string, listener: Listener) {
    const list = this.channels.get(channel)
    if (!list) return this
    const index = list.findIndex(
      (l) => l === listener || (l as Listener & { listener?: Listener }).listener === listener,
    )
    if (index >= 0) list.splice(index, 1)
    if (list.length === 0) this.channels.delete(channel)
    return this
  }

  off(channel: string, listener: Listener) {
    return this.removeListener(channel, listener)
  }

  removeAllListeners(channel?: string) {
    if (channel) this.channels.delete(channel)
    else this.channels.clear()
    return this
  }

  /** No-op: this emitter has no listener cap to raise. */
  setMaxListeners(_count: number) {
    return this
  }

  listenerCount(channel: string) {
    return this.channels.get(channel)?.length ?? 0
  }

  emit(channel: string, ...args: any[]) {
    const list = this.channels.get(channel)
    if (!list?.length) return false
    for (const listener of [...list]) {
      try {
        listener(...args)
      } catch (e) {
        console.error(`[preload] listener of '${channel}' threw`, e)
      }
    }
    return true
  }
}

export default EventEmitter
