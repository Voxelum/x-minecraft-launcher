/**
 * The window/OS half of the renderer contract, served by the Rust shell.
 *
 * Each entry keeps the Electron channel name and return shape so the reused
 * preload modules — and therefore `xmcl-keystone-ui` — need no changes.
 */

type NativeEventSink = (channel: string, args: unknown[]) => void

const sinks = new Set<NativeEventSink>()

/** Subscribe to the events the shell pushes with `WebviewWindow::eval`. */
export function onNativeEvent(sink: NativeEventSink) {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

Object.defineProperty(globalThis, '__XMCL_NATIVE_EVENT__', {
  value: (channel: string, ...args: unknown[]) => {
    for (const sink of [...sinks]) sink(channel, args)
  },
})

interface TauriInternals {
  invoke(command: string, payload?: unknown): Promise<unknown>
}

function internals(): TauriInternals {
  const value = (globalThis as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__
  if (!value) throw new Error('__TAURI_INTERNALS__ is missing: the page is not hosted by the shell')
  return value
}

const invoke = <T>(command: string, payload?: Record<string, unknown>) =>
  internals().invoke(command, payload) as Promise<T>

const unsupported = new Set<string>()

/** Report an Electron capability WebKitGTK/Tauri has no counterpart for, once. */
function reportUnsupported<T>(channel: string, fallback: T): T {
  if (!unsupported.has(channel)) {
    unsupported.add(channel)
    console.warn(`[shell] '${channel}' is not supported by the Tauri shell yet`)
  }
  return fallback
}

/** Electron's `OpenDialogOptions` subset the launcher actually uses. */
interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  properties?: string[]
}

interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

function pickOptions<T>(args: unknown[]): T {
  // Electron accepts both `(options)` and `(window, options)`.
  return (args.find((arg) => typeof arg === 'object' && arg !== null) ?? {}) as T
}

async function readImageData(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Cannot rasterize the image to copy')
  context.drawImage(bitmap, 0, 0)
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height)
  return { rgba: Array.from(data), width, height }
}

export const nativeChannels: Record<string, (...args: any[]) => Promise<any>> = {
  control: (operation: number) => invoke('control', { operation }),
  focus: () => invoke('focus'),
  'flash-frame': () => invoke('flash_frame'),
  'get-monitors': () => invoke('get_monitors'),
  'query-audio-permission': () => invoke('query_audio_permission'),
  'set-translucent': (enable: boolean) => invoke('set_translucent', { enable }),
  'write-clipboard': (text: string) => invoke('write_clipboard', { text }),
  'write-clipboard-image': async (url: string) =>
    invoke('write_clipboard_image', await readImageData(url)),
  'dialog:showOpenDialog': async (...args: unknown[]) => {
    const options = pickOptions<OpenDialogOptions>(args)
    const properties = options.properties ?? []
    const filePaths = await invoke<string[] | null>('plugin:dialog|open', {
      options: {
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
        multiple: properties.includes('multiSelections'),
        directory: properties.includes('openDirectory'),
        recursive: false,
      },
    })
    const paths = filePaths === null ? [] : Array.isArray(filePaths) ? filePaths : [filePaths]
    return { canceled: paths.length === 0, filePaths: paths }
  },
  'dialog:showSaveDialog': async (...args: unknown[]) => {
    const options = pickOptions<SaveDialogOptions>(args)
    const filePath = await invoke<string | null>('plugin:dialog|save', {
      options: {
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
      },
    })
    return { canceled: !filePath, filePath: filePath ?? '' }
  },
  // WebKitGTK has no text finder and no V8 profiler to drive.
  'find-in-page': async () => reportUnsupported('find-in-page', 0),
  'stop-find-in-page': async () => reportUnsupported('stop-find-in-page', undefined),
  'start-profiling': async () => reportUnsupported('start-profiling', undefined),
  'stop-profiling': async () => reportUnsupported('stop-profiling', undefined),
}
