declare module '*.ico' {
  const path: string
  export default path
}

declare module '*.yaml' {
  interface LocalizationData {
    [key: string]: string | LocalizationData
  }
  const messages: LocalizationData
  export default messages
}

declare module 'deskgap' {
  import type { EventEmitter } from 'node:events'

  export interface NativeEvent {
    preventDefault(): void
  }

  export interface TransportChannel {
    readonly writable: WritableStream<ArrayBuffer | ArrayBufferView>
    close(code?: number, reason?: string): void
  }

  export interface InvokeHandlerContext {
    readonly signal: AbortSignal
    readonly webView: WebView
    resolveFileHandle(handle: string): string
  }

  export interface WebView extends EventEmitter {
    readonly id: number
    readonly session: Session
    createChannel(): TransportChannel
    findInPage(text: string, options?: Record<string, unknown>): number
    handle(name: string, handler: (context: InvokeHandlerContext, args: unknown) => unknown): () => void
    isDestroyed(): boolean
    loadFile(path: string): void
    loadURL(url: string): void
    openDevTools(): void
    resume(): void
    setDevToolsEnabled(enabled: boolean): void
    setWindowOpenHandler(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void
    stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
    trySuspend(): Promise<boolean>
  }

  export interface BrowserWindowOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    title?: string
    icon?: string | null
    show?: boolean
    frame?: boolean
    titleBarStyle?: 'default' | 'hidden' | 'hiddenInset'
    backgroundColor?: string
    parent?: BrowserWindow
    modal?: boolean
    autoHideMenuBar?: boolean
    webPreferences?: { session?: Session }
  }

  export class BrowserWindow extends EventEmitter {
    constructor(options?: BrowserWindowOptions)
    static fromWebContents(webView: WebView): BrowserWindow | null
    static getAllWindows(): BrowserWindow[]
    readonly id: number
    readonly webView: WebView
    readonly webContents: WebView
    maximizable: boolean
    minimizable: boolean
    close(): void
    destroy(): void
    flashFrame(flag: boolean): void
    focus(): void
    getNativeWindowHandle(): Buffer
    hide(): void
    isDestroyed(): boolean
    isFocused(): boolean
    isFullScreen(): boolean
    isMaximized(): boolean
    isMinimized(): boolean
    isVisible(): boolean
    loadFile(path: string): void
    loadURL(url: string): void
    maximize(): void
    minimize(): void
    restore(): void
    setIcon(icon: string | null): void
    setBackgroundMaterial(material: 'auto' | 'none' | 'mica' | 'acrylic' | 'tabbed'): void
    setFullScreen(value: boolean): void
    show(): void
    unmaximize(): void
  }

  export interface Session {
    fetch(input: string | URL, init?: RequestInit): Promise<Response>
    setProxy(config: { mode?: 'direct' | 'system' | 'fixed_servers'; proxyRules?: string }): Promise<void>
    setUserAgent(userAgent: string): void
    protocol: {
      handle(scheme: string, handler: (request: Request, context: { signal: AbortSignal }) => Response | Promise<Response>): () => void
    }
  }

  export const session: {
    readonly defaultSession: Session
    fromName(name: string): Session
    fromPartition(partition: string): Session
  }

  export const app: EventEmitter & {
    commandLine: {
      appendSwitch(name: string, value?: string): void
      hasSwitch(name: string): boolean
    }
    exit(code?: number): void
    getAppPath(): string
    getLocale(): string
    getName(): string
    getPath(name: string): string
    getSystemLocale(): string
    getVersion(): string | null
    isDefaultProtocolClient(protocol: string): boolean
    quit(): void
    relaunch(options?: { args?: string[] }): void
    requestSingleInstanceLock(): boolean
    setAppUserModelId(id: string): void
    setAsDefaultProtocolClient(protocol: string): boolean
    setPath(name: string, value: string): void
    whenReady(): Promise<void>
  }

  export const clipboard: {
    writeImage(image: unknown): void
    writeText(text: string): void
  }

  export const credentials: {
    getPassword(service: string, account: string): Promise<string | null>
    setPassword(service: string, account: string, value: string): Promise<void>
  }

  export const dialog: {
    showOpenDialog(window: BrowserWindow, options: unknown): Promise<{ canceled: boolean; filePaths: string[] }>
    showSaveDialog(window: BrowserWindow, options: unknown): Promise<{ canceled: boolean; filePath?: string }>
  }

  export const Menu: {
    buildFromTemplate(template: Array<{
      type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio'
      label?: string
      enabled?: boolean
      checked?: boolean
      click?: () => void
    } | null>): unknown
    setApplicationMenu(menu: unknown): void
  }

  export class Tray extends EventEmitter {
    constructor(image: string)
    destroy(): void
    isDestroyed(): boolean
    setContextMenu(menu: unknown): void
    setImage(image: string): void
    setToolTip(tooltip: string): void
  }

  export const nativeImage: {
    createFromBuffer(buffer: Buffer): unknown
  }

  export const nativeTheme: EventEmitter & {
    readonly shouldUseDarkColors: boolean
  }

  export const screen: {
    getPrimaryDisplay(): { id: string | number; bounds: { x: number; y: number; width: number; height: number } }
    getAllDisplays(): Array<{
      id: string | number
      label: string
      bounds: { x: number; y: number; width: number; height: number }
      size: { width: number; height: number }
    }>
  }

  export const externalWindow: {
    isSupported(): boolean
    moveAndResize(
      processId: number,
      bounds: { x: number; y: number; width: number; height: number },
      options?: { coordinateSpace?: 'dip' | 'screen'; signal?: AbortSignal; timeout?: number },
    ): Promise<void>
  }

  export const shell: {
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<string>
    showItemInFolder(path: string): void
    writeShortcutLink(path: string, operation: 'create' | 'update' | 'replace', details: Record<string, unknown>): boolean
  }

  export const systemPreferences: {
    askForMediaAccess(mediaType: 'microphone' | 'camera'): Promise<boolean>
  }
}