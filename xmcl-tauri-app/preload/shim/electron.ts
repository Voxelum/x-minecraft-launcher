/**
 * Drop-in replacement for the `electron` module inside the webview.
 *
 * `esbuild.config.ts` aliases `electron` to this file, which is what lets the
 * Tauri target reuse the preload modules of `xmcl-electron-app` unchanged
 * instead of forking a second copy of the renderer contract.
 *
 * Channels are routed by owner: window/OS ones reach the Rust shell through
 * Tauri commands, everything else reaches `xmcl-runtime` on the Node sidecar
 * through the bridge socket.
 */

import { bridge } from '../bridge/client'
import { nativeChannels, onNativeEvent } from './native'

type Listener = (event: unknown, ...args: any[]) => void

const listeners = new Map<string, Set<Listener>>()
const onceListeners = new WeakMap<Listener, Listener>()

function emit(channel: string, args: unknown[]) {
  const set = listeners.get(channel)
  if (!set) return
  // The renderer signature is `(event, ...args)`; nothing in the UI reads the
  // event object, so an inert one keeps the contract without faking Electron's.
  const event = { sender: undefined }
  for (const listener of [...set]) listener(event, ...args)
}

onNativeEvent(emit)

export const ipcRenderer = {
  invoke(channel: string, ...args: any[]): Promise<any> {
    const native = nativeChannels[channel]
    if (native) return native(...args)
    return bridge.invoke(channel, ...args)
  },
  send(channel: string, ...args: any[]) {
    const native = nativeChannels[channel]
    if (native) {
      void native(...args)
      return
    }
    bridge.send(channel, ...args)
  },
  on(channel: string, listener: Listener) {
    let set = listeners.get(channel)
    if (!set) {
      set = new Set()
      listeners.set(channel, set)
      bridge.on(channel, (...args: unknown[]) => emit(channel, args))
    }
    set.add(listener)
    return ipcRenderer
  },
  once(channel: string, listener: Listener) {
    const wrapped: Listener = (event, ...args) => {
      ipcRenderer.removeListener(channel, wrapped)
      listener(event, ...args)
    }
    onceListeners.set(listener, wrapped)
    return ipcRenderer.on(channel, wrapped)
  },
  removeListener(channel: string, listener: Listener) {
    const set = listeners.get(channel)
    set?.delete(onceListeners.get(listener) ?? listener)
    return ipcRenderer
  },
  removeAllListeners(channel?: string) {
    if (channel) listeners.delete(channel)
    else listeners.clear()
    return ipcRenderer
  },
}

/**
 * There is no context isolation to cross: the shim runs in the page world, so
 * exposing a global is a plain assignment. The renderer contract is identical.
 */
export const contextBridge = {
  exposeInMainWorld(key: string, value: unknown) {
    Object.defineProperty(globalThis, key, { value, enumerable: true, configurable: true })
  },
}

export const clipboard = {
  writeText(text: string) {
    void nativeChannels['write-clipboard'](text)
  },
}

/**
 * Paths of the files of the most recent drop, published by the shell.
 * WebKitGTK exposes no path on `File`, so this cache is the only source.
 */
const droppedPaths: string[] = []

onNativeEvent((channel, args) => {
  if (channel !== 'drop-paths') return
  droppedPaths.splice(0, droppedPaths.length, ...(args[0] as string[]))
})

export const webUtils = {
  getPathForFile(file: File) {
    const match = droppedPaths.find((path) => path.replace(/\\/g, '/').endsWith(`/${file.name}`))
    return match ?? ''
  },
}

export default { ipcRenderer, contextBridge, clipboard, webUtils }
