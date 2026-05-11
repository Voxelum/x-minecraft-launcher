import { ElectronController } from '@/ElectronController'
import { Inject, LauncherAppKey } from '@xmcl/runtime/app'
import { LauncherApp } from '@xmcl/runtime/app/LauncherApp'
import { AbstractService, ExposeServiceKey, ServiceStateManager, getCurrentClient } from '@xmcl/runtime/service'
import {
  FindInPageOptions,
  OpenDialogOptions,
  OpenDialogResult,
  SaveDialogOptions,
  SaveDialogResult,
  SharedState,
  WindowService as IWindowService,
  WindowServiceKey,
  WindowState,
} from '@xmcl/runtime-api'
import {
  app as electronApp,
  BrowserWindow,
  clipboard,
  dialog,
  nativeImage,
  systemPreferences,
  WebContents,
} from 'electron'
import { writeFile } from 'fs-extra'
import { platform } from 'os'
import { isNiri } from '@/utils/niri'

@ExposeServiceKey(WindowServiceKey)
export class WindowService extends AbstractService implements IWindowService {
  #currentPlatform = platform()
  #attachedWindows = new WeakSet<BrowserWindow>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) private stateManager: ServiceStateManager,
  ) {
    super(app)
  }

  /** Calling renderer's `WebContents`. */
  #sender(): WebContents {
    const client = getCurrentClient()
    if (!client) {
      throw new Error('WindowService method called outside of a service-call dispatch')
    }
    return client as unknown as WebContents
  }

  /** Calling renderer's `BrowserWindow`, or `undefined` for detached web contents. */
  #window(): BrowserWindow | undefined {
    return BrowserWindow.fromWebContents(this.#sender()) ?? undefined
  }

  #controller(): ElectronController {
    return this.app.controller as ElectronController
  }

  async getWindowState(): Promise<SharedState<WindowState>> {
    const win = this.#window()
    if (!win) {
      throw new Error('WindowService.getWindowState called from a non-window WebContents')
    }
    const id = `window://${win.id}`
    return await this.stateManager.registerOrGet<WindowState>(id, async () => {
      const state = new WindowState()
      state.maximized = win.isMaximized() || win.fullScreen
      state.minimized = win.isMinimized()

      const onMaximize = () => state.windowMaximized(win.isMaximized())
      const onUnmaximize = () => state.windowMaximized(false)
      const onEnterFullScreen = () => state.windowMaximized(true)
      const onLeaveFullScreen = () => state.windowMaximized(false)
      const onMinimize = () => state.windowMinimized(true)
      const onRestore = () => state.windowMinimized(false)

      win.on('maximize', onMaximize)
      win.on('unmaximize', onUnmaximize)
      win.on('enter-full-screen', onEnterFullScreen)
      win.on('leave-full-screen', onLeaveFullScreen)
      win.on('minimize', onMinimize)
      win.on('restore', onRestore)

      const dispose = () => {
        win.off('maximize', onMaximize)
        win.off('unmaximize', onUnmaximize)
        win.off('enter-full-screen', onEnterFullScreen)
        win.off('leave-full-screen', onLeaveFullScreen)
        win.off('minimize', onMinimize)
        win.off('restore', onRestore)
      }
      win.once('closed', dispose)

      return [state, dispose]
    })
  }

  async show(): Promise<boolean> {
    const win = this.#window()
    if (win && !win.isVisible()) {
      win.show()
      return true
    }
    return false
  }

  async hide(): Promise<boolean> {
    const win = this.#window()
    if (win?.isVisible()) {
      win.hide()
      return true
    }
    return false
  }

  async close(): Promise<boolean> {
    const win = this.#window()
    if (!win) return false
    if (this.#controller().parking) {
      win.hide()
    } else {
      win.close()
    }
    return true
  }

  async minimize(): Promise<boolean> {
    const win = this.#window()
    if (!win || !win.minimizable) return false
    // On the Niri compositor minimizing can hang/crash the window — skip.
    if (isNiri) return false
    win.minimize()
    return true
  }

  async maximize(): Promise<boolean> {
    const win = this.#window()
    if (!win || !win.maximizable) return false
    if (this.#currentPlatform === 'darwin') {
      win.fullScreen = !win.fullScreen
    } else if (!win.isMaximized()) {
      win.maximize()
    } else {
      win.unmaximize()
    }
    return true
  }

  async focus(): Promise<void> {
    const win = this.#window()
    if (win) win.show()
  }

  async flashFrame(): Promise<void> {
    const win = this.#window()
    if (!win) return
    win.flashFrame(true)
    win.once('focus', () => {
      win.flashFrame(false)
    })
  }

  async setTranslucent(enable: boolean): Promise<void> {
    this.#controller().setWindowTranslucent(enable)
  }

  async queryAudioPermission(): Promise<boolean> {
    if (this.#currentPlatform === 'darwin') {
      await electronApp.whenReady()
      return systemPreferences.askForMediaAccess('microphone')
    }
    return true
  }

  async openMultiplayerWindow(): Promise<void> {
    await this.#controller().openMultiplayerWindow()
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult> {
    const win = this.#window()
    return dialog.showOpenDialog(win!, options as any) as Promise<OpenDialogResult>
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult> {
    const win = this.#window()
    return dialog.showSaveDialog(win!, options as any) as Promise<SaveDialogResult>
  }

  async findInPage(text: string, options?: FindInPageOptions): Promise<void> {
    this.#sender().findInPage(text, options as any)
  }

  async stopFindInPage(): Promise<void> {
    this.#sender().stopFindInPage('clearSelection')
  }

  async startProfiling(): Promise<void> {
    const sender = this.#sender()
    await sender.debugger.sendCommand('Profiler.enable')
    await sender.debugger.sendCommand('Network.enable')
  }

  async stopProfiling(): Promise<void> {
    const sender = this.#sender()
    const data = await sender.debugger.sendCommand('Profiler.stop').then((r) => r.profile).catch(() => null)
    if (!data) return
    const fileName = `profile-${Date.now()}.cpuprofile`
    const win = this.#window()
    const { filePath: path } = await dialog.showSaveDialog(win!, { defaultPath: fileName })
    if (!path) return
    try {
      await writeFile(path, JSON.stringify(data))
    } catch (e) {
      this.error(e as Error)
    }
  }

  async writeClipboard(text: string): Promise<void> {
    clipboard.writeText(text)
  }

  async writeClipboardImage(imageUrl: string): Promise<void> {
    const sender = this.#sender()
    const buf = await sender.session.fetch(imageUrl).then((r) => r.arrayBuffer())
    clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(buf)))
  }
}
