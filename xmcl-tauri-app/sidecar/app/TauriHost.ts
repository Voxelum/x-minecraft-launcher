import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import type { Host } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { ShellClient } from '../shell/ShellClient'

type PathKey = Parameters<Host['getPath']>[0]

function xdgUserDir(key: string, fallback: string) {
  // `xdg-user-dir` is part of xdg-user-dirs, which is not guaranteed; the
  // fallback matches what Electron falls back to as well.
  try {
    const { XDG_DESKTOP_DIR, XDG_DOCUMENTS_DIR, XDG_DOWNLOAD_DIR, XDG_MUSIC_DIR, XDG_PICTURES_DIR, XDG_VIDEOS_DIR } = process.env
    const fromEnv: Record<string, string | undefined> = {
      DESKTOP: XDG_DESKTOP_DIR,
      DOCUMENTS: XDG_DOCUMENTS_DIR,
      DOWNLOAD: XDG_DOWNLOAD_DIR,
      MUSIC: XDG_MUSIC_DIR,
      PICTURES: XDG_PICTURES_DIR,
      VIDEOS: XDG_VIDEOS_DIR,
    }
    return fromEnv[key] ?? fallback
  } catch {
    return fallback
  }
}

/**
 * `Host` implementation backed by Node plus the Rust shell.
 *
 * Everything that Electron answered from the browser process (paths, locale,
 * lifecycle) is computed here; everything that needs a window or the OS
 * integration of the bundle (quit, relaunch, protocol registration) is
 * forwarded to the shell over the stdout control channel.
 */
export class TauriHost implements Host {
  private readonly ready = Promise.resolve()

  constructor(
    private readonly shell: ShellClient,
    private readonly version: string,
    /**
     * The shell owns the single-instance plugin: it only spawns this process
     * when it won the lock, so the runtime's check must not fail here.
     */
    private readonly hasSingleInstanceLock = true,
  ) {}

  getVersion(): string {
    return this.version
  }

  getLocale(): string {
    return process.env.XMCL_LOCALE ?? Intl.DateTimeFormat().resolvedOptions().locale
  }

  getLocaleCountryCode(): string {
    const locale = this.getLocale()
    const region = new Intl.Locale(locale).region
    return region ?? locale.split('-')[1] ?? ''
  }

  getPath(key: PathKey): string {
    const home = homedir()
    switch (key) {
      case 'home':
        return home
      case 'temp':
        return tmpdir()
      case 'exe':
        return process.env.XMCL_SHELL_EXE ?? process.execPath
      case 'module':
        return process.execPath
      case 'appData':
        return this.appData()
      case 'userData':
        return join(this.appData(), LAUNCHER_NAME)
      case 'sessionData':
        return join(this.appData(), LAUNCHER_NAME)
      case 'desktop':
        return xdgUserDir('DESKTOP', join(home, 'Desktop'))
      case 'documents':
        return xdgUserDir('DOCUMENTS', join(home, 'Documents'))
      case 'downloads':
        return xdgUserDir('DOWNLOAD', join(home, 'Downloads'))
      case 'music':
        return xdgUserDir('MUSIC', join(home, 'Music'))
      case 'pictures':
        return xdgUserDir('PICTURES', join(home, 'Pictures'))
      case 'videos':
        return xdgUserDir('VIDEOS', join(home, 'Videos'))
      case 'logs':
        return join(this.appData(), LAUNCHER_NAME, 'logs')
      case 'crashDumps':
        return join(this.appData(), LAUNCHER_NAME, 'crash-dumps')
      case 'recent':
        return process.platform === 'win32'
          ? join(this.appData(), 'Microsoft', 'Windows', 'Recent')
          : join(home, '.local', 'share', 'recently-used.xbel')
      default:
        return join(this.appData(), LAUNCHER_NAME)
    }
  }

  /**
   * Electron's `appData`: the parent of the launcher root. It must keep
   * pointing at the same directory as the Electron build, otherwise an
   * existing installation would look empty after switching shells.
   */
  private appData() {
    if (process.env.XMCL_E2E_APP_DATA) return process.env.XMCL_E2E_APP_DATA
    if (process.platform === 'win32') {
      return process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    }
    if (process.platform === 'darwin') {
      return join(homedir(), 'Library', 'Application Support')
    }
    return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  }

  whenReady(): Promise<void> {
    return this.ready
  }

  requestSingleInstanceLock(): boolean {
    return this.hasSingleInstanceLock
  }

  quit(): void {
    this.shell.quit()
  }

  exit(code = 0): void {
    this.shell.exit(code)
    process.exit(code)
  }

  relaunch(options?: { args?: string[] }): void {
    this.shell.relaunch(options?.args)
  }

  /**
   * On Linux the protocol is owned by the `.desktop` entry of the bundle, on
   * Windows/macOS by the shell's registration. Only the Linux desktop file can
   * be inspected from here without a native call.
   */
  isDefaultProtocolClient(protocol: string): boolean {
    if (process.platform !== 'linux') return false
    const dir = process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')
    return existsSync(join(dir, 'applications', `xmcl-${protocol}.desktop`))
  }

  setAsDefaultProtocolClient(protocol: string): boolean {
    this.shell.registerProtocol(protocol)
    return true
  }

  async getGPUInfo(): Promise<{ gpuDevice?: any[] }> {
    // Electron read this from Chromium's GPU process. WebKitGTK exposes no
    // equivalent, so report what `lspci`/`system_profiler` knows, and nothing
    // on Windows until the shell grows a WMI query.
    if (process.platform === 'linux') {
      const devices = await new Promise<string>((resolve) => {
        execFile('sh', ['-c', 'lspci -nn | grep -Ei "vga|3d|display" || true'], (_, stdout) => resolve(stdout ?? ''))
      })
      const gpuDevice = devices.split('\n').filter(Boolean).map((line) => {
        const ids = /\[([0-9a-f]{4}):([0-9a-f]{4})\]/i.exec(line)
        return {
          active: true,
          vendorId: ids ? Number.parseInt(ids[1], 16) : 0,
          deviceId: ids ? Number.parseInt(ids[2], 16) : 0,
          deviceString: line.trim(),
        }
      })
      return { gpuDevice }
    }
    return {}
  }
}
