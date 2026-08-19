type Listener = (...args: any[]) => void

export class MultiplayerEvents {
  private readonly listeners = new Map<string | symbol, Set<Listener>>()

  on(event: string | symbol, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
    return this
  }

  once(event: string | symbol, listener: Listener) {
    const onceListener: Listener = (...args) => {
      this.removeListener(event, onceListener)
      listener(...args)
    }
    return this.on(event, onceListener)
  }

  removeListener(event: string | symbol, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  removeAllListeners() {
    this.listeners.clear()
  }

  emit(event: string | symbol, ...args: any[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}
