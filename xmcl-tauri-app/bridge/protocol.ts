/**
 * Wire protocol of the local bridge between the webview and the Node sidecar.
 *
 * It is deliberately a transport-level mirror of Electron's `ipcRenderer` /
 * `ipcMain` pair so the preload modules of `xmcl-electron-app` can be reused
 * verbatim on top of it (see `preload/shim/electron.ts`).
 */

export const BRIDGE_PATH = '/bridge'

/** Printed on stdout by the sidecar once the bridge accepts connections. */
export const READY_MARKER = '@@XMCL_SIDECAR_READY@@'

export interface InvokeRequest {
  t: 'invoke'
  id: number
  channel: string
  args: unknown[]
}

export interface SendRequest {
  t: 'send'
  channel: string
  args: unknown[]
}

export type ClientMessage = InvokeRequest | SendRequest

export interface SerializedError {
  name: string
  message: string
  stack?: string
  /**
   * Extra own properties of the original error. The runtime relies on them:
   * `xmcl-keystone-ui` inspects fields like `type` / `errorMessage` on the
   * rejected value.
   */
  [key: string]: unknown
}

export interface ReplyMessage {
  t: 'reply'
  id: number
  ok: boolean
  result?: unknown
  error?: SerializedError
}

export interface EventMessage {
  t: 'event'
  channel: string
  args: unknown[]
}

export type ServerMessage = ReplyMessage | EventMessage

export function serializeError(e: unknown): SerializedError {
  if (e instanceof Error) {
    const extra: Record<string, unknown> = {}
    for (const key of Object.keys(e)) {
      extra[key] = (e as unknown as Record<string, unknown>)[key]
    }
    return { ...extra, name: e.name, message: e.message, stack: e.stack }
  }
  if (typeof e === 'object' && e !== null) {
    return { name: 'Error', message: String(e), ...(e as Record<string, unknown>) }
  }
  return { name: 'Error', message: String(e) }
}

export function deserializeError(error: SerializedError): Error {
  const e = new Error(error.message)
  Object.assign(e, error)
  e.name = error.name
  if (error.stack) e.stack = error.stack
  return e
}

/** Raised when the webview calls a channel the sidecar does not implement. */
export class MissingHandlerError extends Error {
  override name = 'MissingHandlerError'

  constructor(channel: string) {
    super(`No handler registered for '${channel}'`)
  }
}
