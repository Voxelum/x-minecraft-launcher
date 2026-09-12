import type { InstalledAppManifest } from '@xmcl/runtime-api'
import type { Client, LauncherAppController } from '@xmcl/runtime/app'
import type { Logger } from '@xmcl/runtime/infra'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  nativeImage,
  screen,
  shell,
  systemPreferences,
  type InvokeHandlerContext,
  type TransportChannel,
  type WebView,
} from 'deskgap'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { DeskGapLauncherApp } from './launcherApp'
import { TransportFrameDecoder } from './framing'
import { decodeBrowserValue, encodeBrowserFrame, encodeBrowserValue } from './transport'

const textDecoder = new TextDecoder()

type DuplexTransportChannel = TransportChannel & {
  readonly readable: ReadableStream<Uint8Array>
}

type FileHandleWebView = WebView & {
  resolveFileHandle(handle: string): string
}

interface RegisteredHandler {
  handler: (event: { sender: Client }, ...args: any[]) => any
  once: boolean
}

class DeskGapClient extends EventEmitter implements Client {
  private channel?: TransportChannel
  private pending: Uint8Array[] = []
  private writeQueue = Promise.resolve()
  private destroyed = false
  private rendererId?: string

  constructor(
    readonly window: BrowserWindow,
    private readonly invoke: (channel: string, args: any[]) => Promise<any>,
  ) {
    super()
  }

  connect(channel: DuplexTransportChannel) {
    this.channel?.close(1000, 'Replaced by a newer renderer channel')
    this.channel = channel
    void this.read(channel)
    const pending = this.pending
    this.pending = []
    for (const frame of pending) this.write(frame)
  }

  isDestroyed() {
    return this.destroyed || this.window.isDestroyed() || this.window.webView.isDestroyed()
  }

  send(channel: string, ...payload: any[]) {
    if (this.isDestroyed()) return
    this.sendMessage([channel, ...payload])
  }

  private sendMessage(message: unknown) {
    const frame = encodeBrowserFrame(message)
    if (!this.channel) {
      if (this.pending.length < 1_000) this.pending.push(frame)
      return
    }
    this.write(frame)
  }

  private async read(channel: DuplexTransportChannel) {
    const reader = channel.readable.getReader()
    const decoder = new TransportFrameDecoder()
    try {
      while (this.channel === channel) {
        const { value, done } = await reader.read()
        if (done) return
        for (const frame of decoder.push(value)) {
          const encoded = JSON.parse(textDecoder.decode(frame))
          const webView = this.window.webView as FileHandleWebView
          const message = decodeBrowserValue(encoded, handle => webView.resolveFileHandle(handle))
          void this.handleMessage(message)
        }
      }
    } finally {
      if (this.channel === channel) this.channel = undefined
    }
  }

  private async handleMessage(message: any) {
    if (message?.type === 'connect' && typeof message.rendererId === 'string') {
      if (this.rendererId && this.rendererId !== message.rendererId) this.emit('renderer-disconnected')
      this.rendererId = message.rendererId
      return
    }
    if (
      !message || message.type !== 'invoke' || !Number.isSafeInteger(message.id) ||
      typeof message.channel !== 'string' || !Array.isArray(message.args)
    ) return
    try {
      const result = await this.invoke(message.channel, message.args)
      this.sendMessage({ type: 'response', id: message.id, result })
    } catch (error) {
      this.sendMessage({ type: 'response', id: message.id, error })
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.channel?.close(1001, 'Launcher window closed')
    this.channel = undefined
    this.pending = []
    this.emit('destroyed')
    this.removeAllListeners()
  }

  private write(frame: Uint8Array) {
    const channel = this.channel
    if (!channel) return
    this.writeQueue = this.writeQueue.then(async () => {
      const writer = channel.writable.getWriter()
      try {
        await writer.write(frame)
      } finally {
        writer.releaseLock()
      }
    }).catch(() => undefined)
  }
}

export class DeskGapController implements LauncherAppController {
  private readonly handlers = new Map<string, RegisteredHandler>()
  private readonly clients = new Set<DeskGapClient>()
  private readonly handlerDisposers = new Map<DeskGapClient, Map<string, () => void>>()
  private readonly logger: Logger
  private mainWindow?: BrowserWindow
  private mainClient?: DeskGapClient
  private monitorWindow?: BrowserWindow
  private monitorClient?: DeskGapClient
  private migrationWindow?: BrowserWindow
  private migrationClient?: DeskGapClient
  private migrationCompletion?: { resolve(): void; timeout: ReturnType<typeof setTimeout> }
  private parking = false

  constructor(private readonly launcher: DeskGapLauncherApp) {
    this.logger = launcher.getLogger('DeskGapController')
    this.registerWindowHandlers()
    this.handle('migration-complete', ({ sender }) => {
      if (sender !== this.migrationClient) return false
      this.finishMigrationWindow()
      return true
    })
    launcher.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) void launcher.quit()
    })
  }

  handle(channel: string, handler: RegisteredHandler['handler'], once = false) {
    if (this.handlers.has(channel)) throw new Error(`Handler already registered: ${channel}`)
    this.handlers.set(channel, { handler, once })
    for (const client of this.clients) this.bindHandler(client, channel)
  }

  broadcast(channel: string, ...payload: any[]) {
    for (const client of this.clients) client.send(channel, ...payload)
  }

  async activate(manifest: InstalledAppManifest, isBootstrap = false) {
    this.logger.log(`Activate ${manifest.name} (bootstrap=${isBootstrap})`)
    this.parking = true
    try {
      this.mainWindow?.destroy()
      this.logger.log('Create the main DeskGap window')
      const window = new BrowserWindow({
        title: manifest.name,
        icon: this.launcher.getWindowIcon(manifest),
        width: manifest.defaultWidth ?? 1200,
        height: manifest.defaultHeight ?? 720,
        minWidth: manifest.minWidth ?? 800,
        minHeight: manifest.minHeight ?? 400,
        frame: true,
        titleBarStyle: 'hidden',
        backgroundColor: manifest.backgroundColor,
        show: false,
        webPreferences: { session: this.launcher.browserSession },
      })
      this.logger.log(`Created main DeskGap window ${window.id}`)
      this.mainWindow = window
      const client = this.attach(window)
      this.mainClient = client
      this.logger.log('Attached launcher handlers to the main DeskGap window')
      if (process.platform !== 'win32' || process.env.NODE_ENV === 'production') {
        window.webView.setDevToolsEnabled(process.env.NODE_ENV !== 'production')
      }
      window.webView.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url)
        return { action: 'deny' }
      })
      window.webView.on('will-navigate', (event: { preventDefault(): void }, url: string) => {
        if (url.includes('.deskgap.test/')) return
        event.preventDefault()
        void shell.openExternal(url)
      })
      window.webView.on('console-message', (event: { level: string; message: string }) => {
        if (event.level === 'error' || event.level === 'warning') this.logger.warn(event.message)
        else this.logger.log(event.message)
      })
      window.once('ready-to-show', () => {
        window.webView.resume()
        window.show()
        window.focus()
      })
      window.on('maximize', () => client.send('maximize', true))
      window.on('unmaximize', () => client.send('maximize', false))
      window.on('minimize', () => {
        client.send('minimize', true)
        void window.webView.trySuspend()
      })
      window.on('restore', () => {
        window.webView.resume()
        client.send('minimize', false)
      })
      window.once('closed', () => {
        this.detach(client)
        if (this.mainWindow === window) this.mainWindow = undefined
        if (this.mainClient === client) this.mainClient = undefined
      })
      const entry = join(__dirname, 'renderer', isBootstrap ? 'index-bootstrap.html' : 'index.html')
      this.logger.log(`Load renderer ${entry}`)
      window.loadFile(entry)
      this.logger.log('Requested main DeskGap renderer load')
      this.launcher.emit('app-booted', manifest)
    } finally {
      this.parking = false
    }
  }

  requireFocus() {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    window.webView.resume()
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  handleMinecraftWindowReady(hideLauncher: boolean) {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    this.mainClient?.send('minecraft-window-ready')
    if (hideLauncher && (window.isVisible() || window.isMinimized())) {
      window.hide()
      void window.webView.trySuspend()
    }
  }

  setGameRunning(running: boolean) {
    this.parking = running
  }

  handleMinecraftExit(status: unknown) {
    const window = this.mainWindow
    if (window && !window.isDestroyed() && !window.isVisible()) {
      window.webView.resume()
      window.show()
    }
    this.broadcast('minecraft-exit', status)
  }

  getMonitorWindow() {
    if (this.monitorWindow?.isDestroyed()) {
      this.monitorWindow = undefined
      this.monitorClient = undefined
    }
    return this.monitorWindow
  }

  async createMonitorWindow() {
    const existing = this.getMonitorWindow()
    if (existing) {
      existing.show()
      existing.focus()
      return
    }
    await app.whenReady()
    const window = new BrowserWindow({
      title: 'KeyStone Monitor',
      icon: this.launcher.getWindowIcon(this.launcher.builtinAppManifest),
      width: 600,
      height: 400,
      minWidth: 600,
      minHeight: 400,
      frame: true,
      titleBarStyle: 'hidden',
      backgroundColor: this.launcher.builtinAppManifest.backgroundColor,
      show: false,
      webPreferences: { session: this.launcher.browserSession },
    })
    const client = this.attach(window)
    this.monitorWindow = window
    this.monitorClient = client
    if (process.platform !== 'win32' || process.env.NODE_ENV === 'production') {
      window.webView.setDevToolsEnabled(process.env.NODE_ENV !== 'production')
    }
    window.webView.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webView.on('console-message', (event: { level: string; message: string }) => {
      if (event.level === 'error' || event.level === 'warning') this.logger.warn(`[monitor] ${event.message}`)
    })
    window.once('ready-to-show', () => window.show())
    window.once('closed', () => {
      this.detach(client)
      if (this.monitorWindow === window) this.monitorWindow = undefined
      if (this.monitorClient === client) this.monitorClient = undefined
    })
    window.loadFile(join(__dirname, 'renderer', 'logger.html'))
  }

  closeMonitorWindow() {
    const window = this.getMonitorWindow()
    if (window) window.close()
  }

  navigate(path: string) {
    this.requireFocus()
    this.broadcast('navigate', path)
  }

  updateWindowIcon(manifest: InstalledAppManifest) {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    window.setIcon(this.launcher.getWindowIcon(manifest))
  }

  getNativeWindowHandle() {
    return this.mainWindow?.getNativeWindowHandle()
  }

  getLoginSuccessHTML() {
    return '<!doctype html><meta charset="utf-8"><title>XMCL</title><p>Sign-in complete. You can close this window.</p>'
  }

  async openMicrosoftLogin(authorizationUrl: string, redirectUri: string, signal?: AbortSignal) {
    const redirect = new URL(redirectUri)
    await app.whenReady()
    return new Promise<string>((resolve, reject) => {
      const parent = this.mainWindow
      const window = new BrowserWindow({
        title: 'Sign in to Microsoft',
        icon: this.launcher.getWindowIcon(this.launcher.builtinAppManifest),
        width: 560,
        height: 720,
        minWidth: 420,
        minHeight: 600,
        parent,
        modal: !!parent,
        autoHideMenuBar: true,
        show: false,
      })
      let settled = false
      const finish = (error?: Error, code?: string) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        if (!window.isDestroyed()) window.destroy()
        if (error) reject(error)
        else resolve(code!)
      }
      const onAbort = () => finish(new DOMException('Microsoft authorization was cancelled.', 'AbortError'))
      const onNavigate = (event: { preventDefault(): void }, url: string) => {
        const target = new URL(url)
        if (target.origin !== redirect.origin || target.pathname !== redirect.pathname) return
        event.preventDefault()
        const error = target.searchParams.get('error')
        const code = target.searchParams.get('code')
        if (error) finish(new Error(target.searchParams.get('error_description') || error))
        else if (code) finish(undefined, code)
        else finish(new Error('Microsoft authorization returned no code.'))
      }
      window.webView.on('will-navigate', onNavigate)
      window.webView.on('will-redirect', onNavigate)
      window.webView.setWindowOpenHandler(({ url }) => {
        window.loadURL(url)
        return { action: 'deny' }
      })
      window.once('ready-to-show', () => window.show())
      window.once('closed', () => finish(new Error('Microsoft authorization window was closed.')))
      signal?.addEventListener('abort', onAbort, { once: true })
      window.loadURL(authorizationUrl)
    })
  }

  async startMigrate() {
    this.parking = true
    await app.whenReady()
    if (this.migrationWindow && !this.migrationWindow.isDestroyed()) return
    const window = new BrowserWindow({
      title: 'XMCL Launcher Migration',
      icon: this.launcher.getWindowIcon(this.launcher.builtinAppManifest),
      width: 600,
      height: 400,
      frame: false,
      show: false,
      webPreferences: { session: this.launcher.browserSession },
    })
    const client = this.attach(window)
    this.migrationWindow = window
    this.migrationClient = client
    window.webView.on('console-message', (event: { level: string; message: string }) => {
      if (event.level === 'error' || event.level === 'warning') this.logger.warn(`[migration] ${event.message}`)
    })
    window.once('ready-to-show', () => window.show())
    window.once('closed', () => {
      this.detach(client)
      if (this.migrationWindow === window) this.migrationWindow = undefined
      if (this.migrationClient === client) this.migrationClient = undefined
      const completion = this.migrationCompletion
      this.migrationCompletion = undefined
      if (completion) {
        clearTimeout(completion.timeout)
        completion.resolve()
      }
    })
    window.loadFile(join(__dirname, 'renderer', 'migration.html'))
  }

  async endMigrate(result?: { from: string; to: string }) {
    const window = this.migrationWindow
    const client = this.migrationClient
    if (!window || window.isDestroyed() || !client) return
    if (!result) {
      this.finishMigrationWindow()
      return
    }
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => this.finishMigrationWindow(), 2_000)
      this.migrationCompletion = { resolve, timeout }
      client.send('migration-event', { event: 'complete', payload: result })
    })
  }

  private finishMigrationWindow() {
    const completion = this.migrationCompletion
    this.migrationCompletion = undefined
    if (completion) {
      clearTimeout(completion.timeout)
      completion.resolve()
    }
    const window = this.migrationWindow
    if (window && !window.isDestroyed()) window.close()
  }

  private attach(window: BrowserWindow) {
    let client: DeskGapClient
    client = new DeskGapClient(window, (channel, args): Promise<any> => this.invokeHandler(client, channel, args))
    this.clients.add(client)
    this.handlerDisposers.set(client, new Map())
    for (const channel of this.handlers.keys()) this.bindHandler(client, channel)
    window.webView.on('channel-opened', (_event, channel) => client.connect(channel as DuplexTransportChannel))
    return client
  }

  private detach(client: DeskGapClient) {
    for (const dispose of this.handlerDisposers.get(client)?.values() ?? []) dispose()
    this.handlerDisposers.delete(client)
    this.clients.delete(client)
    client.destroy()
  }

  private bindHandler(client: DeskGapClient, channel: string) {
    const registration = this.handlers.get(channel)
    if (!registration) return
    const disposers = this.handlerDisposers.get(client)!
    disposers.get(channel)?.()
    const dispose = client.window.webView.handle(channel, async (context, encodedArgs) => {
      const args = decodeBrowserValue(encodedArgs, handle => context.resolveFileHandle(handle))
      return encodeBrowserValue(await this.invokeHandler(client, channel, Array.isArray(args) ? args : []))
    })
    disposers.set(channel, dispose)
  }

  private async invokeHandler(client: DeskGapClient, channel: string, args: any[]) {
      const current = this.handlers.get(channel)
      if (!current) throw new Error(`Handler is no longer registered: ${channel}`)
      const startedAt = Date.now()
      const traceName = channel === 'service-call'
        ? `${channel} ${String(args[0])}.${String(args[1])}`
        : channel
      if (process.env.XMCL_DESKGAP_TRACE_INVOKE === '1') this.logger.log(`Invoke ${traceName}`)
      try {
        return await current.handler({ sender: client }, ...args)
      } finally {
        if (process.env.XMCL_DESKGAP_TRACE_INVOKE === '1') {
          this.logger.log(`Completed ${traceName} in ${Date.now() - startedAt}ms`)
        }
        if (current.once) this.removeHandler(channel)
      }
  }

  private removeHandler(channel: string) {
    this.handlers.delete(channel)
    for (const disposers of this.handlerDisposers.values()) {
      disposers.get(channel)?.()
      disposers.delete(channel)
    }
  }

  private getWindow(sender: Client) {
    return (sender as DeskGapClient).window
  }

  private registerWindowHandlers() {
    this.handle('window.focus', ({ sender }) => this.getWindow(sender).focus())
    this.handle('window.write-clipboard', (_, text: string) => clipboard.writeText(text))
    this.handle('window.show-open-dialog', ({ sender }, options) => dialog.showOpenDialog(this.getWindow(sender), options))
    this.handle('window.show-save-dialog', ({ sender }, options) => dialog.showSaveDialog(this.getWindow(sender), options))
    this.handle('window.find-in-page', ({ sender }, text, options) => this.getWindow(sender).webView.findInPage(text, options))
    this.handle('window.stop-find-in-page', ({ sender }) => this.getWindow(sender).webView.stopFindInPage('clearSelection'))
    this.handle('window.start-profiling', () => false)
    this.handle('window.stop-profiling', () => false)
    this.handle('window.flash-frame', ({ sender }) => {
      const window = this.getWindow(sender)
      window.flashFrame(true)
      window.once('focus', () => window.flashFrame(false))
    })
    this.handle('window.write-clipboard-image', async ({ sender }, imageUrl: string) => {
      const response = await this.getWindow(sender).webView.session.fetch(imageUrl)
      clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer())))
    })
    this.handle('window.query-audio-permission', async () => {
      if (process.platform !== 'darwin') return true
      return systemPreferences.askForMediaAccess('microphone')
    })
    this.handle('window.get-monitors', () => {
      const primary = screen.getPrimaryDisplay()
      return screen.getAllDisplays().map(display => ({
        id: String(display.id),
        label: display.label,
        width: display.size.width,
        height: display.size.height,
        primary: display.id === primary.id,
      }))
    })
    this.handle('window.set-translucent', ({ sender }, enable: boolean) => {
      if (process.platform === 'win32') {
        try { this.getWindow(sender).setBackgroundMaterial(enable ? 'acrylic' : 'auto') } catch {}
      }
    })
    this.handle('window.control', ({ sender }, operation: string) => {
      const window = this.getWindow(sender)
      if (operation === 'maximize') {
        if (!window.maximizable) return false
        if (process.platform === 'darwin') window.setFullScreen(!window.isFullScreen())
        else if (window.isMaximized()) window.unmaximize()
        else window.maximize()
      } else if (operation === 'minimize') {
        if (!window.minimizable) return false
        window.minimize()
      } else if (operation === 'hide') {
        window.hide()
        void window.webView.trySuspend()
      } else if (operation === 'show') {
        window.webView.resume()
        window.show()
      } else if (operation === 'close') {
        if (this.parking) {
          window.hide()
          void window.webView.trySuspend()
        } else {
          window.close()
        }
      }
      else return false
      return true
    })
  }
}