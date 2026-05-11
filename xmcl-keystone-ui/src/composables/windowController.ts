import { ServiceChannel, WindowService, WindowServiceKey } from '@xmcl/runtime-api'

/**
 * Renderer-side facade exposing the `WindowService` under the legacy
 * `windowController` name. It exists purely to keep the call sites
 * across the renderer codebase compact — every method delegates straight
 * to the standard `serviceChannels` dispatcher.
 *
 * The shim is auto-imported (see vite.config.ts) so call sites do not
 * have to add an import line.
 */
let cachedChannel: ServiceChannel<WindowService> | undefined
function getChannel(): ServiceChannel<WindowService> {
  if (!cachedChannel) {
    cachedChannel = serviceChannels.open(WindowServiceKey)
  }
  return cachedChannel
}

const methodCache: Record<string, (...args: any[]) => any> = Object.create(null)

/**
 * Many call sites use these methods as Vue template `@click` handlers
 * (e.g. `@click="maximize"`), so the first argument is a `MouseEvent`.
 * The original preload-side `windowController` declared each method with
 * no parameters and silently dropped the event; the IPC payload was
 * always a fixed value. The new service-channel transport, by contrast,
 * forwards the args verbatim — and Electron's structured-clone fails on
 * `Event` instances with "An object could not be cloned."
 *
 * To preserve the legacy ergonomics we strip DOM `Event` args here,
 * scoped to this shim only.
 */
function stripEventArgs(args: unknown[]): unknown[] {
  return args.filter((a) => !(typeof Event !== 'undefined' && a instanceof Event))
}

export const windowController: WindowService = new Proxy({} as WindowService, {
  get(_, prop: string | symbol) {
    if (prop === 'on' || prop === 'once' || prop === 'removeListener') {
      // Event subscription — delegate directly so listeners attach to
      // the channel's own EventEmitter (typed via ServiceChannel).
      const channel = getChannel() as any
      return channel[prop].bind(channel)
    }
    if (typeof prop !== 'string') return undefined
    if (methodCache[prop]) return methodCache[prop]
    const fn = (...args: any[]) => getChannel().call(prop as any, ...stripEventArgs(args) as any)
    methodCache[prop] = fn
    return fn
  },
})
