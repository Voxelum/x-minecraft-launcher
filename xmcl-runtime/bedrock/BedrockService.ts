import {
  BedrockException,
  BedrockInstallation,
  BedrockService as IBedrockService,
  BedrockServiceKey,
  MINECRAFT_BEDROCK_PACKAGE_FAMILY,
  MINECRAFT_BEDROCK_STORE_PRODUCT_ID,
  InstallBedrockTask,
} from '@xmcl/runtime-api'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { Inject, LauncherAppKey } from '~/app'
import { type Tasks, kTasks } from '~/infra'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

const execFileAsync = promisify(execFile)

function runCommandWithProgress(cmd: string, args: string[], task: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true })

    let stderr = ''
    child.stdout.on('data', (data) => {
      const text = data.toString()
      const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) {
        const percent = Math.round(parseFloat(match[1]));
        task.progress = { progress: percent, total: 100 }
      }
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command ${cmd} exited with code ${code}. Error: ${stderr}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}


const MINECRAFT_BEDROCK_AUMID = `${MINECRAFT_BEDROCK_PACKAGE_FAMILY}!Game`


@ExposeServiceKey(BedrockServiceKey)
export class BedrockService extends AbstractService implements IBedrockService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app)
  }

  async isSupported(): Promise<boolean> {
    return this.app.platform.os === 'windows'
  }

  #assertSupported() {
    if (this.app.platform.os !== 'windows') {
      throw new BedrockException({ type: 'bedrockUnsupportedPlatform' },
        'Minecraft Bedrock Edition is only supported on the Windows build.')
    }
  }

  async getInstallation(): Promise<BedrockInstallation> {
    const empty: BedrockInstallation = { installed: false, version: '', packageFullName: '' }
    if (this.app.platform.os !== 'windows') {
      return empty
    }
    try {
      // Query the installed UWP package via PowerShell. The output is emitted
      // as `Version|PackageFullName` so it can be parsed without relying on a
      // localized table layout.
      const script = '$ErrorActionPreference=\'SilentlyContinue\';' +
        '$p = Get-AppxPackage -Name Microsoft.MinecraftUWP | Select-Object -First 1;' +
        'if ($p) { Write-Output ("{0}|{1}" -f $p.Version, $p.PackageFullName) }'
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
      ], { windowsHide: true })
      const line = stdout.toString().trim()
      if (!line) {
        return empty
      }
      const [version, packageFullName] = line.split('|')
      return {
        installed: true,
        version: (version ?? '').trim(),
        packageFullName: (packageFullName ?? '').trim(),
      }
    } catch (e) {
      this.warn(`Failed to query Minecraft Bedrock installation: ${e}`)
      return empty
    }
  }

  async install(): Promise<void> {
    this.#assertSupported()

    let installedSucceeded = false

    // 1. Try to install via native/pre-installed 'store' CLI
    try {
      this.log('Attempting to install Minecraft Bedrock Edition via store CLI...')
      
      // Check if store CLI is available
      await execFileAsync('store.exe', ['--help'], { windowsHide: true })
      
      const task = this.tasks.create<InstallBedrockTask>({
        type: 'installBedrock',
        key: 'install-bedrock',
      })
      
      try {
        await runCommandWithProgress('store.exe', [
          'install',
          MINECRAFT_BEDROCK_STORE_PRODUCT_ID
        ], task)
        
        task.complete()
        installedSucceeded = true
        this.log('Successfully installed Minecraft Bedrock Edition via store CLI.')
      } catch (err) {
        task.fail(err)
        this.warn(`store CLI install failed: ${err}.`)
      }
    } catch (e) {
      this.warn(`store CLI is not available: ${e}.`)
    }

    // 2. Fall back to winget
    if (!installedSucceeded) {
      try {
        this.log('Attempting to install Minecraft Bedrock Edition via winget...')
        await execFileAsync('winget.exe', ['--version'], { windowsHide: true })
        
        const task = this.tasks.create<InstallBedrockTask>({
          type: 'installBedrock',
          key: 'install-bedrock',
        })
        
        try {
          await runCommandWithProgress('winget.exe', [
            'install',
            '--id', MINECRAFT_BEDROCK_STORE_PRODUCT_ID,
            '--source', 'msstore',
            '--accept-package-agreements',
            '--accept-source-agreements'
          ], task)
          
          task.complete()
          installedSucceeded = true
          this.log('Successfully installed Minecraft Bedrock Edition via winget.')
        } catch (err) {
          task.fail(err)
          this.warn(`winget install failed: ${err}.`)
        }
      } catch (e) {
        this.warn(`winget is not available: ${e}.`)
      }
    }

    // 3. Fall back to Microsoft Store PDP URL in browser
    if (!installedSucceeded) {
      const url = `ms-windows-store://pdp/?productid=${MINECRAFT_BEDROCK_STORE_PRODUCT_ID}`
      const opened = await this.app.shell.openInBrowser(url)
      if (!opened) {
        throw new BedrockException({ type: 'bedrockInstallFailed' },
          'Failed to open the Microsoft Store to install Minecraft Bedrock Edition.')
      }
    }
  }

  async launch(): Promise<void> {
    this.#assertSupported()
    const installation = await this.getInstallation()
    if (!installation.installed) {
      throw new BedrockException({ type: 'bedrockNotInstalled' },
        'Minecraft Bedrock Edition is not installed.')
    }
    try {
      // Activate the UWP package through the shell AppsFolder entry. The game
      // uses the Microsoft account currently signed in on Windows.
      await execFileAsync('explorer.exe', [`shell:AppsFolder\\${MINECRAFT_BEDROCK_AUMID}`], { windowsHide: true })
    } catch (e) {
      // `explorer.exe` can return a non-zero exit code even on a successful
      // activation, so only surface the error when the spawn itself failed.
      if (isNodeError(e) && e.code === 'ENOENT') {
        throw new BedrockException({ type: 'bedrockLaunchFailed' },
          'Failed to launch Minecraft Bedrock Edition.', { cause: e })
      }
    }
    this.log(`Launched Minecraft Bedrock Edition (${installation.version})`)
  }

  async isRunning(): Promise<boolean> {
    if (this.app.platform.os !== 'windows') {
      return false
    }
    try {
      const { stdout } = await execFileAsync('tasklist.exe', [
        '/FI', 'IMAGENAME eq Minecraft.Windows.exe', '/NH',
      ], { windowsHide: true })
      return stdout.includes('Minecraft.Windows.exe')
    } catch {
      return false
    }
  }

  async killGame(): Promise<void> {
    if (this.app.platform.os !== 'windows') {
      return
    }
    try {
      await execFileAsync('taskkill.exe', [
        '/F', '/IM', 'Minecraft.Windows.exe',
      ], { windowsHide: true })
      this.log('Killed Minecraft Bedrock process.')
    } catch (e) {
      this.warn(`Failed to kill Minecraft Bedrock process: ${e}`)
    }
  }
}

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error
}
