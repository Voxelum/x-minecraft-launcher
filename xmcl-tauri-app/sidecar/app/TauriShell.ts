import type { Shell } from '@xmcl/runtime/app'
import { execFile } from 'child_process'
import { writeFileSync } from 'fs'
import { stat } from 'fs-extra'
import { dirname } from 'path'

function run(file: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    execFile(file, args, (error) => resolve(!error))
  })
}

/**
 * `Shell` implementation without Electron: the OS integrations Electron's
 * `shell` module provided are done with the platform's own tools.
 */
export class TauriShell implements Shell {
  async openDirectory(path: string): Promise<boolean> {
    const fstat = await stat(path).catch(() => undefined)
    if (!fstat?.isDirectory()) return false
    return await this.open(path)
  }

  async openInBrowser(url: string): Promise<boolean> {
    // Only hand the OS schemes a browser can handle; `openInBrowser` is
    // reachable from remote app manifests through `appsHost`.
    const protocol = (() => {
      try {
        return new URL(url).protocol
      } catch {
        return ''
      }
    })()
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:') return false
    return await this.open(url)
  }

  showItemInFolder(path: string): void {
    if (process.platform === 'win32') {
      void run('explorer.exe', [`/select,${path}`])
    } else if (process.platform === 'darwin') {
      void run('open', ['-R', path])
    } else {
      // `--reveal` needs a FileManager1 implementation; fall back to the parent
      // directory, which is what most Linux file managers give anyway.
      void run('dbus-send', [
        '--session',
        '--dest=org.freedesktop.FileManager1',
        '--type=method_call',
        '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1.ShowItems',
        `array:string:file://${path}`,
        'string:""',
      ]).then((ok) => {
        if (!ok) void this.open(dirname(path))
      })
    }
  }

  /**
   * Electron used `shell.writeShortcutLink` (a real `.lnk` through IShellLink).
   * `.lnk` cannot be produced from pure Node, so Windows goes through the
   * WScript.Shell COM object, and Linux writes a freedesktop `.desktop` entry.
   */
  createShortcut(path: string, link: {
    appUserModelId?: string
    args?: string
    cwd?: string
    description?: string
    icon?: string
    iconIndex?: number
    target: string
    toastActivatorClsid?: string
  }): boolean {
    try {
      if (process.platform === 'win32') {
        const script = [
          '$s = (New-Object -COM WScript.Shell).CreateShortcut(' + quotePwsh(path) + ')',
          '$s.TargetPath = ' + quotePwsh(link.target),
          link.args ? '$s.Arguments = ' + quotePwsh(link.args) : '',
          link.cwd ? '$s.WorkingDirectory = ' + quotePwsh(link.cwd) : '',
          link.description ? '$s.Description = ' + quotePwsh(link.description) : '',
          link.icon ? '$s.IconLocation = ' + quotePwsh(`${link.icon},${link.iconIndex ?? 0}`) : '',
          '$s.Save()',
        ].filter(Boolean).join('; ')
        void run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
        return true
      }
      const desktop = [
        '[Desktop Entry]',
        'Type=Application',
        'Version=1.0',
        `Name=${link.description || 'X Minecraft Launcher'}`,
        `Exec=${link.target}${link.args ? ` ${link.args}` : ''}`,
        link.cwd ? `Path=${link.cwd}` : '',
        link.icon ? `Icon=${link.icon}` : '',
        'Terminal=false',
        'Categories=Game;',
        '',
      ].filter(Boolean).join('\n')
      writeFileSync(path.endsWith('.desktop') ? path : `${path}.desktop`, desktop, { mode: 0o755 })
      return true
    } catch {
      return false
    }
  }

  private open(target: string) {
    if (process.platform === 'win32') return run('cmd.exe', ['/c', 'start', '""', target])
    if (process.platform === 'darwin') return run('open', [target])
    return run('xdg-open', [target])
  }
}

function quotePwsh(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}
