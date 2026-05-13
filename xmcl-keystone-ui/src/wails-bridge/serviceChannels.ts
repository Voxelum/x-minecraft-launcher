/**
 * wails-bridge / serviceChannels
 *
 * A drop-in replacement for the Electron preload's `serviceChannels`
 * global, backed by Wails v3's runtime instead of `ipcRenderer`. This
 * lets the existing renderer code (`useService`, `useState`, etc.)
 * keep working without modification when the app is hosted under
 * `xmcl-wails-app/`.
 *
 * Wire protocol mirror (matches xmcl-electron-app/preload/service.ts):
 *
 *  - service-call → `Bridge.Invoke(serviceKey, method, args[]) → {result|error}`
 *  - commit       → `Bridge.Commit(stateId, methodName, args[])`
 *  - unref        → `Bridge.Unref(stateId)`
 *  - revalidate   → `Bridge.Revalidate(stateId, args[])`
 *  - service-event (push, main → renderer) → Wails Event "service-event"
 *  - commit (push, main → renderer)        → Wails Event "commit"
 *
 * `SharedState` reconstruction reuses the prototype tables defined in
 * `@xmcl/runtime-api` (`AllStates`) — exactly the same approach as the
 * Electron preload, so renderer code that depends on prototype methods
 * and `subscribe(...)` semantics works unchanged.
 */

import {
  GameOptionsState,
  InstanceInstallStatus,
  InstanceModsGroupState,
  InstanceState,
  JavaState,
  LocalVersions,
  ModpackState,
  PeerState,
  ResourceState,
  Saves,
  type ServiceChannels,
  type ServiceKey,
  Settings,
  type SharedState,
  type StateMetadata,
  UserState,
  WindowState,
} from '@xmcl/runtime-api'

// =============================================================================
// Wails v3 runtime imports — types only; the actual runtime is loaded by the
// asset server at /wails/runtime.js. We use a dynamic import so the bundler
// doesn't try to resolve it at build time.
// =============================================================================

interface WailsRuntime {
  Call: {
    ByName: <T = unknown>(method: string, ...args: unknown[]) => Promise<T>
  }
  Events: {
    On: (name: string, cb: (e: { name: string; data: unknown }) => void) => void
    Off: (name: string) => void
  }
}

const BRIDGE = 'github.com/voxelum/xmcl/wails/internal/bridge.Bridge'
const BRIDGE_INVOKE = `${BRIDGE}.Invoke`
const BRIDGE_COMMIT = `${BRIDGE}.Commit`
const BRIDGE_UNREF = `${BRIDGE}.Unref`
const BRIDGE_REVALIDATE = `${BRIDGE}.Revalidate`

// Lazily-resolved promise that yields the Wails runtime once it's loaded.
let runtimePromise: Promise<WailsRuntime> | null = null

function getRuntime(): Promise<WailsRuntime> {
  if (runtimePromise) return runtimePromise
  // The runtime is served from `/wails/runtime.js` by Wails' asset handler.
  // Use a runtime-only string + dynamic import so neither tsc nor vite try
  // to resolve it at build time. Cast through unknown to silence the typed
  // signature.
  const path = '/wails/runtime.js'
  runtimePromise = (import(/* @vite-ignore */ path) as unknown) as Promise<WailsRuntime>
  return runtimePromise
}

// =============================================================================
// Tiny EventEmitter — we don't pull node:events into the renderer bundle.
// =============================================================================

class TinyEmitter {
  private listeners: Record<string, Array<(...args: any[]) => void>> = {}

  on(event: string, fn: (...args: any[]) => void) {
    ;(this.listeners[event] ??= []).push(fn)
    return this
  }

  once(event: string, fn: (...args: any[]) => void) {
    const wrapped = (...a: any[]) => {
      this.removeListener(event, wrapped)
      fn(...a)
    }
    return this.on(event, wrapped)
  }

  removeListener(event: string, fn: (...args: any[]) => void) {
    const list = this.listeners[event]
    if (!list) return this
    this.listeners[event] = list.filter((l) => l !== fn)
    return this
  }

  emit(event: string, ...args: any[]) {
    const list = this.listeners[event]
    if (!list) return false
    for (const fn of list.slice()) {
      try { fn(...args) } catch (e) { console.error(e) }
    }
    return true
  }
}

// =============================================================================
// State prototype registry (mirrors xmcl-electron-app/preload/service.ts).
// =============================================================================

const ALL_STATES = [
  Settings,
  InstanceState,
  ResourceState,
  ModpackState,
  GameOptionsState,
  Saves,
  JavaState,
  UserState,
  LocalVersions,
  PeerState,
  InstanceInstallStatus,
  InstanceModsGroupState,
  WindowState,
] as const

function getPrototypeMetadata(T: { new(): object }, prototype: object, name: string): StateMetadata {
  const methods = Object.getOwnPropertyNames(prototype)
    .map((n) => [n, Object.getOwnPropertyDescriptor(prototype, n)?.value] as const)
    .filter(([, v]) => typeof v === 'function')
  return {
    name,
    constructor: () => new T(),
    methods: methods.map(([n, f]) => [n, f as (this: any, ...args: any[]) => any] as [string, (this: any, ...args: any[]) => any]),
    prototype,
  }
}

const stateRegistry: Record<string, StateMetadata> = ALL_STATES.reduce((acc, cur) => {
  acc[cur.name] = getPrototypeMetadata(cur, cur.prototype, cur.name)
  return acc
}, {} as Record<string, StateMetadata>)

const kEmitter = Symbol('Emitter')
const kMethods = Symbol('Methods')

function createSharedState<T extends object>(
  payload: T,
  id: string,
  methods: StateMetadata['methods'],
): SharedState<T> {
  const emitter = new TinyEmitter()
  Object.defineProperty(payload, kEmitter, { value: emitter })
  Object.defineProperty(payload, kMethods, { value: methods })
    return Object.assign(payload, {
    id,
    subscribe(key: string, listener: (p: any) => void) {
      emitter.on(key, listener)
      return this
    },
    unsubscribe(key: string, listener: (p: any) => void) {
      emitter.removeListener(key, listener)
      return this
    },
    subscribeAll(listener: (key: string, p: any) => void) {
      emitter.on('*', listener)
      return this
    },
    unsubscribeAll(listener: (key: string, p: any) => void) {
      emitter.removeListener('*', listener)
      return this
    },
    revalidate() {
      void getRuntime().then((r) => r.Call.ByName(BRIDGE_REVALIDATE, id, []))
    },
  }) as any
}

// =============================================================================
// State book-keeping. Mirrors the preload: WeakRef + FinalizationRegistry to
// drop the Go-side container when the renderer GC's the state object.
// =============================================================================

const states: Record<string, WeakRef<SharedState<object>>> = {}
const pendingCommits: Record<string, { type: string; payload: any }[]> = {}

const finalizer = new FinalizationRegistry<string>((id) => {
  delete states[id]
  void getRuntime().then((r) => r.Call.ByName(BRIDGE_UNREF, id))
})

// =============================================================================
// Service-event book-keeping. Each ServiceKey gets its own EventEmitter; we
// keep it WeakRef'd so unused channels can GC.
// =============================================================================

const serviceEmitters = new Map<string, WeakRef<TinyEmitter>>()

function getServiceEmitter(key: string): TinyEmitter {
  let em = serviceEmitters.get(key)?.deref()
  if (!em) {
    em = new TinyEmitter()
    serviceEmitters.set(key, new WeakRef(em))
  }
  return em
}

// =============================================================================
// Result decoding (mirrors preload's `receive`).
// =============================================================================

function reconstructState<T extends object>(result: any): SharedState<T> | null {
  if (!result || typeof result !== 'object') return null
  if (!('__state__' in result)) return null

  const id: string = result.id
  const existing = states[id]?.deref() as SharedState<T> | undefined
  if (existing) {
    Object.assign(existing, result)
    return existing
  }

  const meta = stateRegistry[result.__state__]
  if (!meta) {
    throw new TypeError(`Unknown state object ${result.__state__} (renderer/runtime version mismatch?)`)
  }

  // Strip wire-only fields before assigning onto the payload.
  const clone = { ...result }
  delete clone.__state__
  // `id` is restored by createSharedState below.
  delete clone.id

  const state = createSharedState(clone, id, meta.methods)

  // Replace prototype mutator methods with bridge.Commit round-trips so
  // renderer-driven mutations persist on the Go side.
  for (const [methodName] of meta.methods) {
    ;(state as any)[methodName] = (...args: any[]) => {
      void getRuntime().then((r) => r.Call.ByName(BRIDGE_COMMIT, id, methodName, args))
    }
  }

  finalizer.register(state, id)
  states[id] = new WeakRef(state)

  // Drain commits that arrived before this state object existed.
  queueMicrotask(() => {
    const drained = pendingCommits[id]
    if (!drained) return
    delete pendingCommits[id]
    for (const m of drained) replayCommit(state as any, m.type, m.payload)
  })

  return state as SharedState<T>
}

function replayCommit(state: any, type: string, payload: any) {
  const emitter: TinyEmitter | undefined = state[kEmitter]
  if (!emitter) return
  emitter.emit(type, payload)
  emitter.emit('*', type, payload)
  const methods: StateMetadata['methods'] | undefined = state[kMethods]
  const m = methods?.find(([n]) => n === type)
  if (m) m[1].call(state, payload)
}

async function decodeResponse(envelope: any): Promise<any> {
  if (!envelope || typeof envelope !== 'object') return envelope
  const { result, error } = envelope as { result?: any; error?: any }
  if (error) {
    if (error.errorMessage) {
      error.toString = () => error.errorMessage
    }
    return Promise.reject(error)
  }
  // DEBUG: dump SharedState envelopes so we can see why
  // state.value.instances ends up undefined in the renderer.
  if (result && typeof result === 'object' && '__state__' in result) {
    const dbg = result as Record<string, unknown>
    // eslint-disable-next-line no-console
    console.log('[wails-bridge] decoded SharedState',
      dbg.__state__,
      'id=', dbg.id,
      'keys=', Object.keys(dbg),
      'instancesType=', Array.isArray(dbg.instances) ? `array(${(dbg.instances as unknown[]).length})` : typeof dbg.instances,
      'allType=', dbg.all && typeof dbg.all === 'object' ? `object(${Object.keys(dbg.all as object).length})` : typeof dbg.all,
    )
  }
  const reconstructed = reconstructState(result)
  if (reconstructed && '__state__' in (reconstructed as any) === false) {
    const r = reconstructed as any
    // eslint-disable-next-line no-console
    console.log('[wails-bridge] reconstructed state',
      'id=', r.id,
      'keys=', Object.keys(r),
      'instancesType=', Array.isArray(r.instances) ? `array(${r.instances.length})` : typeof r.instances,
    )
  }
  return reconstructed ?? result
}

// =============================================================================
// Push event subscriptions — installed once on first runtime resolution.
// =============================================================================

let pushSubscribed = false
async function ensurePushSubscriptions() {
  if (pushSubscribed) return
  pushSubscribed = true
  const r = await getRuntime()

  r.Events.On('service-event', (e) => {
    const data = (e as any).data as { service: string; event: string; args: any[] } | undefined
    if (!data) return
    const em = serviceEmitters.get(data.service)?.deref()
    if (em) em.emit(data.event, ...(data.args ?? []))
  })

  r.Events.On('commit', (e) => {
    const data = (e as any).data as { id: string; type: string; payload: any } | undefined
    if (!data) return
    const state = states[data.id]?.deref()
    if (state) {
      replayCommit(state, data.type, data.payload)
    } else {
      ;(pendingCommits[data.id] ??= []).push({ type: data.type, payload: data.payload })
    }
  })

  r.Events.On('state-validating', (e) => {
    const data = (e as any).data as { id: string; semaphore: boolean } | undefined
    if (!data) return
    const state = states[data.id]?.deref() as any
    state?.[kEmitter]?.emit('state-validating', data.semaphore)
  })
}

// =============================================================================
// Public factory
// =============================================================================

export function createWailsServiceChannels(): ServiceChannels {
  // Subscribe to push channels eagerly — we don't know which services the
  // renderer will use, but listening costs nothing.
  void ensurePushSubscriptions()

  return {
    open<T>(serviceKey: ServiceKey<T>) {
      const key = serviceKey as unknown as string
      const emitter = getServiceEmitter(key)
      return {
        key: serviceKey,
        on(channel: any, listener: any) { emitter.on(channel, listener); return this },
        once(channel: any, listener: any) { emitter.once(channel, listener); return this },
        removeListener(channel: any, listener: any) { emitter.removeListener(channel, listener); return this },
        async call(method: any, ...payload: any[]) {
          const r = await getRuntime()
          const envelope = await r.Call.ByName(BRIDGE_INVOKE, key, method as string, payload)
          return decodeResponse(envelope)
        },
      } as any
    },
  }
}

/**
 * Install the Wails-backed `serviceChannels` onto `globalThis` so the rest
 * of the renderer (which assumes the Electron preload already ran) finds
 * it. Call once, as early as possible — ideally from a `<script>` tag in
 * `index.html` before the SPA bundle.
 */
export function installWailsServiceChannels() {
  if ((globalThis as any).serviceChannels) return // already installed
  ;(globalThis as any).serviceChannels = createWailsServiceChannels()
}
