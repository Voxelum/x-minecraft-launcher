import type {
  Bootstrap,
  ServiceChannels,
  ServiceKey,
  SharedState,
  TaskMonitor,
  Tasks,
  WindowController,
} from '@xmcl/runtime-api'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import type { Monitor } from '@xmcl/runtime-api/monitor'
import { TransportFrameDecoder } from './framing'
import { createRendererTelemetry, createServiceCalls } from './serviceBridge'

const nativeFileHandlePrefix = 'deskgap-file-handle:'
const pendingMigrationKey = 'xmcl-deskgap-pending-migration'
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
const rendererId = Array.from(
  crypto.getRandomValues(new Uint32Array(4)),
  value => value.toString(16),
).join('-')

function encodeTransportValue(value: unknown, seen = new WeakSet<object>()): any {
  if (value === undefined) return { __xmclTransportType: 'undefined' }
  if (typeof value === 'bigint') return { __xmclTransportType: 'bigint', value: value.toString() }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return { __xmclTransportType: 'bytes', value: bytesToBase64(bytes) }
  }
  if (value instanceof ArrayBuffer) {
    return { __xmclTransportType: 'bytes', value: bytesToBase64(new Uint8Array(value)) }
  }
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) throw new TypeError('Cannot send a cyclic value to the launcher host')
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map(entry => encodeTransportValue(entry, seen))
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encodeTransportValue(entry, seen)]))
  } finally {
    seen.delete(value)
  }
}

function decodeTransportValue(value: unknown): any {
  if (Array.isArray(value)) return value.map(decodeTransportValue)
  if (value === null || typeof value !== 'object') return value
  const tagged = value as { __xmclTransportType?: string; value?: string }
  if (tagged.__xmclTransportType === 'undefined') return undefined
  if (tagged.__xmclTransportType === 'bigint') return BigInt(tagged.value!)
  if (tagged.__xmclTransportType === 'bytes') return base64ToBytes(tagged.value!)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decodeTransportValue(entry)]))
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

interface NativeFileDropEntry {
  readonly handle: string
  readonly kind: 'file' | 'directory'
  readonly name: string
  readonly size: number | null
}

interface TransportChannel {
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<ArrayBuffer | ArrayBufferView>
}

interface DeskGapBrowserClient {
  createChannel(): TransportChannel
  onFilesDropped(listener: (event: { entries: readonly NativeFileDropEntry[] }) => void): () => void
}

declare global {
  interface Window {
    deskgap?: DeskGapBrowserClient
  }
}

class Emitter {
  private readonly listeners = new Map<string, Set<(...args: any[]) => void>>()

  on(event: string, listener: (...args: any[]) => void) {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(event, listeners)
    }
    listeners.add(listener)
    return this
  }

  once(event: string, listener: (...args: any[]) => void) {
    const wrapped = (...args: any[]) => {
      this.removeListener(event, wrapped)
      listener(...args)
    }
    return this.on(event, wrapped)
  }

  removeListener(event: string, listener: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string, ...args: any[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}

class LauncherTransport {
  private channel?: TransportChannel
  private nextRequestId = 1
  private readonly pending = new Map<number, {
    resolve: (value: any) => void
    reject: (error: unknown) => void
  }>()
  private readonly readyWaiters = new Set<() => void>()
  private writeQueue = Promise.resolve()

  constructor(
    private readonly deskgap: DeskGapBrowserClient,
    private readonly dispatch: (channel: string, payload: any[]) => void,
  ) {
    void this.connect()
  }

  async invoke<Result>(channel: string, args: any[]): Promise<Result> {
    const transportChannel = await this.waitForChannel()
    const id = this.nextRequestId++
    return await new Promise<Result>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      void this.enqueueWrite(transportChannel, { type: 'invoke', id, channel, args }).catch(error => {
        const pending = this.pending.get(id)
        if (!pending) return
        this.pending.delete(id)
        pending.reject(error)
      })
    })
  }

  private async waitForChannel(): Promise<TransportChannel> {
    while (!this.channel) {
      await new Promise<void>(resolve => this.readyWaiters.add(resolve))
    }
    return this.channel
  }

  private async connect() {
    while (true) {
      let channel: TransportChannel
      try {
        channel = this.deskgap.createChannel()
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      this.channel = channel
      try {
        await this.enqueueWrite(channel, { type: 'connect', rendererId })
        for (const resolve of this.readyWaiters) resolve()
        this.readyWaiters.clear()
        await readTransportFrames(channel.readable, message => this.receive(message))
      } catch (error) {
        console.error('XMCL transport disconnected', error)
      } finally {
        if (this.channel === channel) this.channel = undefined
        const error = new Error('XMCL transport disconnected')
        for (const pending of this.pending.values()) pending.reject(error)
        this.pending.clear()
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  private receive(message: any) {
    if (Array.isArray(message) && typeof message[0] === 'string') {
      this.dispatch(message[0], message.slice(1))
      return
    }
    if (!message || message.type !== 'response' || !Number.isSafeInteger(message.id)) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.error) {
      const source = message.error
      const error = Object.assign(new Error(source.message || 'Launcher host request failed'), source)
      pending.reject(error)
    } else {
      pending.resolve(message.result)
    }
  }

  private enqueueWrite(channel: TransportChannel, message: unknown) {
    const writing = this.writeQueue.then(() => writeTransportFrame(channel, message))
    this.writeQueue = writing.catch(() => undefined)
    return writing
  }
}

function installBridge(deskgap: DeskGapBrowserClient) {
  const windowEvents = new Emitter()
  const taskEvents = new Emitter()
  const servicesEmitters = new Map<ServiceKey<any>, WeakRef<Emitter>>()
  const states: Record<string, WeakRef<SharedState<object>>> = {}
  const pendingCommits: Record<string, { type: string; payload: any }[]> = {}
  const stateEmitter = Symbol('stateEmitter')
  let droppedEntries: NativeFileDropEntry[] = []
  let dropGeneration = 0

  const transport = new LauncherTransport(deskgap, dispatch)
  const invoke = <Result>(channel: string, ...args: any[]) => transport.invoke<Result>(channel, args)

  function createSharedState<T extends object>(value: T, id: string): SharedState<T> {
    const emitter = new Emitter()
    Object.defineProperty(value, stateEmitter, { value: emitter })
    return Object.assign(value, {
      subscribe(key: string, listener: (payload: any) => void) {
        emitter.on(key, listener)
        return this
      },
      unsubscribe(key: string, listener: (payload: any) => void) {
        emitter.removeListener(key, listener)
        return this
      },
      subscribeAll(listener: (type: string, payload: any) => void) {
        emitter.on('*', listener)
        return this
      },
      unsubscribeAll(listener: (type: string, payload: any) => void) {
        emitter.removeListener('*', listener)
        return this
      },
      commit(method: string, ...args: any[]) {
        return invoke('commit', id, method, ...args)
      },
      revalidate() {
        void invoke('revalidate', id)
      },
      unref() {
        void invoke('unref', id)
      },
    }) as unknown as SharedState<T>
  }

  const gc = new FinalizationRegistry<string>((id) => {
    delete states[id]
    void invoke('unref', id)
  })

  async function receive(message: any): Promise<any> {
    if (typeof message !== 'object' || message === null) return message
    const { result, error } = message
    if (error) return Promise.reject(error)
    if (!result || typeof result !== 'object' || !('__state__' in result)) return result

    const id = String(result.id)
    const existing = states[id]?.deref()
    if (existing) {
      Object.assign(existing, result)
      return existing
    }

    delete result.__state__
    const state = createSharedState(result, id)
    gc.register(state, id)
    states[id] = new WeakRef(state)
    queueMicrotask(() => {
      for (const mutation of pendingCommits[id] ?? []) {
        const emitter = (state as any)[stateEmitter] as Emitter
        emitter.emit(mutation.type, mutation.payload)
        emitter.emit('*', mutation.type, mutation.payload)
      }
      delete pendingCommits[id]
    })
    return state
  }

  const serviceChannels: ServiceChannels = {
    open(serviceKey) {
      let emitter = servicesEmitters.get(serviceKey)?.deref()
      if (!emitter) {
        emitter = new Emitter()
        servicesEmitters.set(serviceKey, new WeakRef(emitter))
      }
      return {
        key: serviceKey,
        on: emitter.on.bind(emitter),
        once: emitter.once.bind(emitter),
        removeListener: emitter.removeListener.bind(emitter),
        ...createServiceCalls(serviceKey, invoke, receive),
      } as any
    },
  }

  const taskMonitor: TaskMonitor = {
    poll: () => invoke<Tasks[]>('task-poll'),
    check: () => invoke<boolean>('task-check'),
    cancel: (taskId: string) => invoke<void>('task-operation', { type: 'cancel', id: taskId }),
    clear: () => invoke<void>('task-clear'),
    on(channel, listener) {
      taskEvents.on(channel, listener)
      return taskMonitor
    },
    once(channel, listener) {
      taskEvents.once(channel, listener)
      return taskMonitor
    },
    removeListener(channel, listener) {
      taskEvents.removeListener(channel, listener)
      return taskMonitor
    },
  }

  const windowController: WindowController = {
    show: () => { void invoke('window.control', 'show') },
    flashFrame: () => { void invoke('window.flash-frame') },
    focus: () => { void invoke('window.focus') },
    hide: () => { void invoke('window.control', 'hide') },
    close: () => { void invoke('window.control', 'close') },
    minimize: () => { void invoke('window.control', 'minimize') },
    maximize: () => { void invoke('window.control', 'maximize') },
    queryAudioPermission: () => invoke<boolean>('window.query-audio-permission'),
    getMonitors: () => invoke('window.get-monitors'),
    writeClipboard: (text: string) => { void invoke('window.write-clipboard', text) },
    writeClipboardImage: (imageUrl: string) => { void invoke('window.write-clipboard-image', imageUrl) },
    getPathForFile(file: File) {
      const index = droppedEntries.findIndex(entry =>
        entry.name === file.name && (entry.size === null || entry.size === file.size))
      if (index === -1) return ''
      const [entry] = droppedEntries.splice(index, 1)
      return `${nativeFileHandlePrefix}${entry.handle}`
    },
    findInPage: (text, options) => { void invoke('window.find-in-page', text, options) },
    startProfiling: () => { void invoke('window.start-profiling') },
    stopProfiling: () => { void invoke('window.stop-profiling') },
    stopFindInPage: () => { void invoke('window.stop-find-in-page') },
    showOpenDialog: options => invoke('window.show-open-dialog', options),
    showSaveDialog: options => invoke('window.show-save-dialog', options),
    setTranslucent: enable => { void invoke('window.set-translucent', enable) },
    on(channel, listener) {
      windowEvents.on(channel, listener)
      return windowController
    },
    once(channel, listener) {
      windowEvents.once(channel, listener)
      return windowController
    },
    removeListener(channel, listener) {
      windowEvents.removeListener(channel, listener)
      return windowController
    },
  }

  const bootstrap: Bootstrap = {
    preset: () => invoke('preset'),
    bootstrap: path => invoke('bootstrap', path),
  }

  const gameMonitor: Monitor = {
    on(event, listener) {
      serviceChannels.open(LaunchServiceKey).on(event, listener as (...args: any[]) => void)
    },
  }

  function dispatch(channel: string, payload: any[]) {
    if (channel === 'task-activated') taskEvents.emit(channel, ...payload)
    else if (channel === 'maximize' || channel === 'minimize' || channel === 'navigate') {
      windowEvents.emit(channel, ...payload)
    } else if (channel === 'service-event') {
      const event = payload[0]
      servicesEmitters.get(event.service)?.deref()?.emit(event.event, ...event.args)
    } else if (channel === 'state-validating') {
      const event = payload[0]
      const state = states[event.id]?.deref()
      if (state) (state as any)[stateEmitter].emit('state-validating', event.semaphore)
    } else if (channel === 'commit') {
      const [id, type, mutationPayload] = payload
      const state = states[id]?.deref()
      if (state) {
        const emitter = (state as any)[stateEmitter] as Emitter
        emitter.emit(type, mutationPayload)
        emitter.emit('*', type, mutationPayload)
      } else {
        ;(pendingCommits[id] ??= []).push({ type, payload: mutationPayload })
      }
    }
  }

  deskgap.onFilesDropped(({ entries }) => {
    const generation = ++dropGeneration
    droppedEntries = [...entries]
    setTimeout(() => {
      if (generation === dropGeneration) droppedEntries = []
    }, 10_000)
  })

  const rendererTelemetry = createRendererTelemetry(invoke)
  Object.assign(globalThis, { bootstrap, gameMonitor, serviceChannels, taskMonitor, windowController, rendererTelemetry })
}

async function writeTransportFrame(channel: TransportChannel, message: unknown) {
  const body = textEncoder.encode(JSON.stringify(encodeTransportValue(message)))
  const frame = new Uint8Array(body.byteLength + 4)
  new DataView(frame.buffer).setUint32(0, body.byteLength)
  frame.set(body, 4)
  const writer = channel.writable.getWriter()
  try {
    await writer.write(frame)
  } finally {
    writer.releaseLock()
  }
}

async function readTransportFrames(
  readable: ReadableStream<Uint8Array>,
  receive: (message: any) => void,
) {
  const reader = readable.getReader()
  const decoder = new TransportFrameDecoder()
  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    for (const frame of decoder.push(value)) {
      const message = decodeTransportValue(JSON.parse(textDecoder.decode(frame)))
      receive(message)
    }
  }
}

function applyPendingMigration() {
  try {
    const serialized = localStorage.getItem(pendingMigrationKey)
    if (!serialized) return
    const migration = JSON.parse(serialized)
    if (typeof migration.from !== 'string' || typeof migration.to !== 'string') return
    const url = new URL(location.href)
    url.searchParams.set('from', migration.from)
    url.searchParams.set('to', migration.to)
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    localStorage.removeItem(pendingMigrationKey)
  } catch (error) {
    console.error('Cannot restore the XMCL migration result', error)
  }
}

applyPendingMigration()
if (window.deskgap) installBridge(window.deskgap)