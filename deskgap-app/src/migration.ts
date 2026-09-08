import type { Migration, MigrationProgress } from '@xmcl/runtime-api/migration'

const pendingMigrationKey = 'xmcl-deskgap-pending-migration'
const textDecoder = new TextDecoder()

interface TransportChannel {
  readonly readable: ReadableStream<Uint8Array>
}

interface MigrationBrowserClient {
  invoke<Result = unknown, Args = null>(name: string, args?: Args): Promise<Result>
  createChannel(): TransportChannel
}

class Emitter {
  private readonly listeners = new Map<string, Set<(payload: any) => void>>()

  on(event: string, listener: (payload: any) => void) {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(event, listeners)
    }
    listeners.add(listener)
  }

  emit(event: string, payload: any) {
    for (const listener of this.listeners.get(event) ?? []) listener(payload)
  }
}

function installBridge(deskgap: MigrationBrowserClient) {
  const emitter = new Emitter()
  const invoke = <Result>(channel: string, ...args: any[]) =>
    deskgap.invoke<Result, any[]>(channel, args)

  const migration: Migration = {
    on(event, listener) {
      emitter.on(event, listener)
    },
    getProgress() {
      return invoke<MigrationProgress>('migration-get-progress')
    },
  }

  const windowController = {
    hide() {
      void invoke('window.control', 'hide')
    },
  }

  Object.assign(globalThis, { migration, windowController })
  void connectEventChannel(deskgap, async (channel, payload) => {
    if (channel !== 'migration-event') return
    const event = payload[0]
    if (!event || typeof event.event !== 'string') return
    if (event.event === 'complete') {
      localStorage.setItem(pendingMigrationKey, JSON.stringify(event.payload))
      await invoke('migration-complete')
      return
    }
    emitter.emit(event.event, event.payload)
  })
}

async function connectEventChannel(
  deskgap: MigrationBrowserClient,
  receive: (channel: string, payload: any[]) => Promise<void> | void,
) {
  while (true) {
    let channel: TransportChannel
    try {
      channel = deskgap.createChannel()
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
      continue
    }
    try {
      await readEventFrames(channel.readable, receive)
    } catch (error) {
      console.error('XMCL migration event channel disconnected', error)
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

async function readEventFrames(
  readable: ReadableStream<Uint8Array>,
  receive: (channel: string, payload: any[]) => Promise<void> | void,
) {
  const reader = readable.getReader()
  let buffered = new Uint8Array()
  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    const next = new Uint8Array(buffered.byteLength + value.byteLength)
    next.set(buffered)
    next.set(value, buffered.byteLength)
    buffered = next
    while (buffered.byteLength >= 4) {
      const length = new DataView(buffered.buffer, buffered.byteOffset, 4).getUint32(0)
      if (buffered.byteLength < length + 4) break
      const message = JSON.parse(textDecoder.decode(buffered.subarray(4, length + 4)))
      buffered = buffered.slice(length + 4)
      if (Array.isArray(message) && typeof message[0] === 'string') {
        await receive(message[0], message.slice(1))
      }
    }
  }
}

const deskgap = (window as unknown as { deskgap?: MigrationBrowserClient }).deskgap
if (deskgap) installBridge(deskgap)