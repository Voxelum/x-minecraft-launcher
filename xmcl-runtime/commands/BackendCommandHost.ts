import { AnyError } from '@xmcl/utils'
import {
  CommandContext,
  CommandMode,
  CommandOutput,
  CommandRegistry,
  InstanceNotFoundError,
  PromptSpec,
  SelectOptions,
  ServiceKey,
  TaskHandle,
  UserNotFoundError,
  commands as defaultCommands,
} from '@xmcl/runtime-api'
import type { Instance } from '@xmcl/instance'
import type { UserProfile } from '@xmcl/runtime-api'
import { LauncherApp } from '../app'
import { AbstractService, ServiceConstructor, getServiceKey } from '../service/Service'
import { Logger } from '../infra'

/**
 * Lookup map ServiceKey → concrete service constructor. Built once at host
 * startup from the same `definedServices` list used by `pluginServicesHandler`,
 * so the command system reuses the existing DI graph.
 */
export type ServiceLocator = (key: ServiceKey<any>) => ServiceConstructor | undefined

/**
 * Build a `ServiceLocator` from an array of service constructors. The
 * `ServiceKey` is read from the `ExposeServiceKey` reflection metadata.
 */
export function createServiceLocator(services: ReadonlyArray<ServiceConstructor>): ServiceLocator {
  const map = new Map<string, ServiceConstructor>()
  for (const ctor of services) {
    const key = getServiceKey(ctor)
    if (key) map.set(String(key), ctor)
  }
  return (key) => map.get(String(key))
}

/**
 * Sink for prompts/selects when running headless. The default impl throws
 * `MissingInputError` — hosts can plug in TTY readers or IPC bridges.
 */
export interface InteractiveBridge {
  prompt(spec: PromptSpec): Promise<string>
  confirm(message: string): Promise<boolean>
  select<T>(opts: SelectOptions<T>): Promise<T>
  pickInstance(): Promise<Instance>
  pickUser(): Promise<UserProfile>
}

/**
 * Output sink. Default writes to stdout / stderr.
 */
export function createStdoutOutput(json = false): CommandOutput {
  return {
    log(message: string) {
      process.stdout.write(`${message}\n`)
    },
    json(payload: unknown) {
      if (!json) return
      process.stdout.write(`${JSON.stringify(payload)}\n`)
    },
    table(rows) {
      // Avoid pulling a dep — minimal CSV-ish layout is good enough for now.
      if (rows.length === 0) return
      const cols = Object.keys(rows[0])
      process.stdout.write(`${cols.join('\t')}\n`)
      for (const r of rows) {
        process.stdout.write(`${cols.map((c) => String(r[c] ?? '')).join('\t')}\n`)
      }
    },
  }
}

export interface BackendCommandHostOptions {
  app: LauncherApp
  registry?: CommandRegistry
  serviceLocator: ServiceLocator
  logger?: Logger
  bridge?: Partial<InteractiveBridge>
  out?: CommandOutput
}

/**
 * Backend host that wires {@link CommandContext} to the runtime's DI graph
 * (`app.registry` + service constructors). One host instance per process.
 */
export class BackendCommandHost {
  readonly registry: CommandRegistry
  readonly app: LauncherApp
  readonly serviceLocator: ServiceLocator
  readonly bridge: InteractiveBridge
  readonly logger?: Logger
  readonly defaultOut: CommandOutput

  constructor(opts: BackendCommandHostOptions) {
    this.app = opts.app
    this.registry = opts.registry ?? defaultCommands
    this.serviceLocator = opts.serviceLocator
    this.logger = opts.logger
    this.defaultOut = opts.out ?? createStdoutOutput(false)
    const fallback: InteractiveBridge = {
      prompt: async (s) => { throw new AnyError('CommandMissingInput', `Missing input '${s.field}'`) },
      confirm: async () => { throw new AnyError('CommandMissingInput', 'Confirmation required but no input source available') },
      select: async (o) => { throw new AnyError('CommandMissingInput', `Selection required for '${o.field}'`) },
      pickInstance: async () => { throw new AnyError('CommandMissingInput', 'Instance selection required') },
      pickUser: async () => { throw new AnyError('CommandMissingInput', 'User selection required') },
    }
    this.bridge = { ...fallback, ...opts.bridge }
  }

  /**
   * Resolve a service instance by key, ensuring it is initialized exactly
   * once (matches `pluginServicesHandler.get` semantics).
   */
  async resolveService<T extends AbstractService>(key: ServiceKey<T>): Promise<T> {
    const ctor = this.serviceLocator(key)
    if (!ctor) {
      throw new AnyError('ServiceNotFoundError', `No registered service for key '${String(key)}'`)
    }
    const service = await this.app.registry.getOrCreate(ctor)
    await service.initialize()
    return service as T
  }

  /**
   * Build a fresh {@link CommandContext} for a dispatch. Reusing host
   * helpers keeps every dispatch consistent.
   */
  createContext(opts: { mode?: CommandMode; signal?: AbortSignal; out?: CommandOutput } = {}): CommandContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const host = this
    const mode = opts.mode ?? 'cli'
    const signal = opts.signal ?? new AbortController().signal
    const out = opts.out ?? this.defaultOut

    const ctx: CommandContext = {
      mode,
      signal,
      out,
      async call(key, method, ...args) {
        const service = await host.resolveService(key as ServiceKey<any>)
        const fn = (service as any)[method]
        if (typeof fn !== 'function') {
          throw new AnyError('ServiceMethodNotFoundError', `Service '${String(key)}' has no method '${String(method)}'`)
        }
        return fn.apply(service, args)
      },
      async state() {
        // For the backend, state objects are accessed through service
        // methods (e.g. `getSettings`, `getUserState`). Keep this stub
        // until a concrete need surfaces.
        throw new AnyError('NotImplemented', 'CommandContext.state is not implemented for the backend host')
      },
      async resolveInstance(ref: string): Promise<Instance> {
        const { InstanceServiceKey } = await import('@xmcl/runtime-api')
        const state = await ctx.call(InstanceServiceKey, 'getSharedInstancesState')
        const byPath = state.all[ref]
        if (byPath) return byPath
        const byName = state.instances.find((i) => i.name === ref)
        if (byName) return byName
        throw new InstanceNotFoundError(ref)
      },
      async resolveUser(ref?: string): Promise<UserProfile> {
        const { UserServiceKey } = await import('@xmcl/runtime-api')
        const state = await ctx.call(UserServiceKey, 'getUserState')
        if (ref) {
          const byId = state.users[ref]
          if (byId) return byId
          const byName = Object.values(state.users).find((u) => u.username === ref)
          if (byName) return byName
          throw new UserNotFoundError(ref)
        }
        // No explicit ref — fall back to the first known user, matching the
        // legacy `directLaunch` behaviour. If none, prompt.
        const first = Object.values(state.users)[0]
        if (first) return first
        return host.bridge.pickUser()
      },
      pickInstance: () => host.bridge.pickInstance(),
      pickUser: () => host.bridge.pickUser(),
      prompt: (spec) => host.bridge.prompt(spec),
      confirm: (msg) => host.bridge.confirm(msg),
      select: (opts) => host.bridge.select(opts),
      async task<T>(name: string, run: (handle: TaskHandle) => Promise<T>): Promise<T> {
        // Lightweight in-process task — backend telemetry can be wired up later.
        const handle: TaskHandle = {
          update(progress, total, message) {
            host.logger?.log(`[${name}] ${progress}${total ? `/${total}` : ''} ${message ?? ''}`)
          },
          child: (childName) => ({
            update(progress, total, message) {
              host.logger?.log(`[${name}/${childName}] ${progress}${total ? `/${total}` : ''} ${message ?? ''}`)
            },
            child: (n) => handle.child(n),
          }),
        }
        return run(handle)
      },
    }
    return ctx
  }

  /**
   * Validate input and dispatch a command. Errors are surfaced verbatim;
   * the CLI driver is responsible for formatting them.
   */
  async dispatch<O = unknown>(id: string, input: unknown, opts?: Parameters<this['createContext']>[0]): Promise<O> {
    const ctx = this.createContext(opts)
    return this.registry.dispatch<O>(id, input, ctx)
  }
}
