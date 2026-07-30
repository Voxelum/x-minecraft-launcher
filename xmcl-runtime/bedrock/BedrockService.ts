import {
  BedrockException,
  BedrockInstallation,
  BedrockInstalledVersion,
  BedrockService as IBedrockService,
  BedrockServiceKey,
  BedrockVersion,
  BedrockVersionType,
  MINECRAFT_BEDROCK_PACKAGE_FAMILY,
  MINECRAFT_BEDROCK_PREVIEW_PACKAGE_FAMILY,
  MINECRAFT_BEDROCK_STORE_PRODUCT_ID,
  InstallBedrockTask,
  InstallBedrockVersionTask,
} from '@xmcl/runtime-api'
import { download } from '@xmcl/file-transfer'
import { Tracker, onDownloadSingle } from '@xmcl/installer'
import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { ensureDir, readdir, readJson, remove, writeJson } from 'fs-extra'
import { join } from 'path'
import { promisify } from 'util'
import { Inject, LauncherAppKey, type PathResolver, kGameDataPath } from '~/app'
import { GFW, kGFW, type Tasks, kTasks } from '~/infra'
import { kDownloadOptions } from '~/network'
import { AbstractService, ExposeServiceKey } from '~/service'
import { getTracker } from '~/util/taskHelper'
import { LauncherApp } from '../app/LauncherApp'
import {
  DeveloperModeRequiredError,
  enableDeveloperMode,
  extractAppx,
  getRegisteredInstallLocation,
  isDeveloperModeEnabled,
  registerPackage,
  unregisterPackage,
} from './appx'
import { resolveBedrockDownloadUrl } from './fe3'
import { fetchBedrockVersionList } from './versionList'

const execFileAsync = promisify(execFile)

/**
 * A small marker file written into each extracted version directory so the
 * release channel is known even when offline (the version database may be
 * unreachable).
 */
const VERSION_META_FILE = 'bedrock-version.json'

interface VersionMeta {
  version: string
  type: BedrockVersionType
}

function normalizePath(p: string | undefined): string {
  return (p ?? '').replace(/[\\/]+$/, '').toLowerCase()
}

function sanitizeVersionDir(version: string): string {
  return version.replace(/[^0-9A-Za-z._-]/g, '_')
}

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


// The manifest Application Id of Minecraft Bedrock is `App`, so the default
// AUMID is `Microsoft.MinecraftUWP_8wekyb3d8bbwe!App`. This is used as a
// fallback only; the real AUMID is resolved from the installed package
// manifest so it also works for Preview and side-loaded (registered) builds.
const MINECRAFT_BEDROCK_AUMID = `${MINECRAFT_BEDROCK_PACKAGE_FAMILY}!App`


@ExposeServiceKey(BedrockServiceKey)
export class BedrockService extends AbstractService implements IBedrockService {
  #versionListCache: BedrockVersion[] | undefined

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kGFW) private gfw: GFW,
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
    const empty: BedrockInstallation = { installed: false, version: '', packageFullName: '', aumid: '' }
    if (this.app.platform.os !== 'windows') {
      return empty
    }
    try {
      // Query the installed UWP package via PowerShell. The output is emitted
      // as `Version|PackageFullName|Aumid` so it can be parsed without relying
      // on a localized table layout. The AUMID (PackageFamilyName!AppId) is
      // read from the package manifest so activation works for Store, Preview
      // and side-loaded (registered) builds, whose Application Id may differ.
      const script = '$ErrorActionPreference=\'SilentlyContinue\';' +
        '$p = Get-AppxPackage -Name Microsoft.MinecraftUWP | Select-Object -First 1;' +
        'if ($p) {' +
        '  $appId = @((Get-AppxPackageManifest $p).Package.Applications.Application)[0].Id;' +
        '  $aumid = if ($appId) { $p.PackageFamilyName + "!" + $appId } else { "" };' +
        '  Write-Output ("{0}|{1}|{2}" -f $p.Version, $p.PackageFullName, $aumid)' +
        '}'
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
      ], { windowsHide: true })
      const line = stdout.toString().trim()
      if (!line) {
        return empty
      }
      const [version, packageFullName, aumid] = line.split('|')
      return {
        installed: true,
        version: (version ?? '').trim(),
        packageFullName: (packageFullName ?? '').trim(),
        aumid: (aumid ?? '').trim(),
      }
    } catch (e) {
      this.warn(`Failed to query Minecraft Bedrock installation: ${e}`)
      return empty
    }
  }

  async getStoragePaths() {
    if (this.app.platform.os !== 'windows') {
      return undefined
    }
    const installation = await this.getInstallation()
    if (!installation.installed) {
      return undefined
    }
    const packageFamily = installation.aumid.split('!')[0] || MINECRAFT_BEDROCK_PACKAGE_FAMILY
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) {
      return undefined
    }
    const dataPath = join(localAppData, 'Packages', packageFamily, 'LocalState')
    if (!existsSync(dataPath)) {
      return undefined
    }
    const logsPath = join(dataPath, 'logs')
    return {
      dataPath,
      logsPath: existsSync(logsPath) ? logsPath : dataPath,
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
    // Prefer the AUMID resolved from the installed package manifest; fall back
    // to the well-known default when the manifest query returned nothing.
    const aumid = installation.aumid || MINECRAFT_BEDROCK_AUMID
    try {
      // Activate the UWP package through the shell AppsFolder entry. The game
      // uses the Microsoft account currently signed in on Windows.
      await execFileAsync('explorer.exe', [`shell:AppsFolder\\${aumid}`], { windowsHide: true })
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

  // ---------------------------------------------------------------------------
  // Multi-version coexistence
  //
  // Windows only keeps ONE registration per UWP package family per user, so
  // "coexistence" means: keep several versions extracted on disk and re-register
  // (switch to) whichever one the user wants to play. Registering a loose
  // (unsigned) extracted package requires Windows Developer Mode.
  // ---------------------------------------------------------------------------

  #versionsRoot() {
    return this.getPath('bedrock-versions')
  }

  #versionDir(version: string) {
    return join(this.#versionsRoot(), sanitizeVersionDir(version))
  }

  #familyForType(type: BedrockVersionType) {
    return type === 'preview'
      ? MINECRAFT_BEDROCK_PREVIEW_PACKAGE_FAMILY
      : MINECRAFT_BEDROCK_PACKAGE_FAMILY
  }

  async getVersionList(force?: boolean): Promise<BedrockVersion[]> {
    if (!force && this.#versionListCache) {
      return this.#versionListCache
    }
    const cachePath = join(this.#versionsRoot(), 'version-db.json')
    if (!force) {
      try {
        const cached = await readJson(cachePath) as { time: number; versions: BedrockVersion[] }
        if (cached && Date.now() - cached.time < 24 * 60 * 60 * 1000 && Array.isArray(cached.versions)) {
          this.#versionListCache = cached.versions
          return cached.versions
        }
      } catch {
        // no cache yet
      }
    }
    const versions = await fetchBedrockVersionList(this.gfw.inside)
    this.#versionListCache = versions
    await ensureDir(this.#versionsRoot()).catch(() => undefined)
    await writeJson(cachePath, { time: Date.now(), versions }).catch(() => undefined)
    return versions
  }

  async getInstalledVersions(): Promise<BedrockInstalledVersion[]> {
    if (this.app.platform.os !== 'windows') {
      return []
    }
    const root = this.#versionsRoot()
    let dirs: string[]
    try {
      dirs = await readdir(root)
    } catch {
      return []
    }
    // Resolve the currently registered install location for each family once.
    const [releaseLoc, previewLoc] = await Promise.all([
      getRegisteredInstallLocation(MINECRAFT_BEDROCK_PACKAGE_FAMILY).catch(() => undefined),
      getRegisteredInstallLocation(MINECRAFT_BEDROCK_PREVIEW_PACKAGE_FAMILY).catch(() => undefined),
    ])
    const result: BedrockInstalledVersion[] = []
    for (const dir of dirs) {
      const path = join(root, dir)
      let meta: VersionMeta
      try {
        meta = await readJson(join(path, VERSION_META_FILE)) as VersionMeta
      } catch {
        continue
      }
      if (!meta?.version) continue
      const activeLoc = meta.type === 'preview' ? previewLoc : releaseLoc
      const active = normalizePath(activeLoc) === normalizePath(path)
      result.push({ version: meta.version, type: meta.type, path, active })
    }
    // Newest-looking versions first (string compare is good enough for x.y.z.w).
    result.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
    return result
  }

  async installVersion(version: BedrockVersion): Promise<void> {
    this.#assertSupported()

    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    const downloadUrl = await resolveBedrockDownloadUrl(
      version.updateIdentity,
      '1',
      downloadOptions.dispatcher,
    ).catch((e) => {
      this.warn(`Failed to resolve Bedrock download URL for ${version.version}: ${e}`)
      return undefined
    })
    if (!downloadUrl) {
      throw new BedrockException({ type: 'bedrockDownloadUrlUnavailable' },
        version.type === 'release'
          ? 'Failed to resolve the download URL for this Bedrock version.'
          : 'Failed to resolve the download URL. Beta/preview builds require a Microsoft account subscribed to the beta programme.')
    }

    const dir = this.#versionDir(version.version)
    const cacheDir = join(this.#versionsRoot(), '.cache')
    const appxPath = join(cacheDir, `${sanitizeVersionDir(version.version)}.appx`)
    await ensureDir(cacheDir)

    const task = this.tasks.create<InstallBedrockVersionTask>({
      type: 'installBedrockVersion',
      key: `install-bedrock-version-${version.version}`,
      version: version.version,
    })

    try {
      const tracker = getTracker(task)
      await download({
        url: downloadUrl,
        destination: appxPath,
        signal: task.controller.signal,
        tracker: onDownloadSingle(tracker as Tracker<any>, 'download', {}),
        ...downloadOptions,
      })

      // Fresh extraction: wipe any previous copy of this version first.
      await remove(dir).catch(() => undefined)
      await ensureDir(dir)
      await extractAppx(appxPath, dir, (done, total) => {
        task.progress = { progress: done, total }
      })
      await writeJson(join(dir, VERSION_META_FILE), { version: version.version, type: version.type } as VersionMeta)

      task.complete()
      this.log(`Installed Minecraft Bedrock ${version.version} to ${dir}`)
    } catch (e) {
      task.fail(e)
      throw e
    } finally {
      await remove(appxPath).catch(() => undefined)
    }
  }

  async #findInstalled(version: string): Promise<BedrockInstalledVersion> {
    const installed = await this.getInstalledVersions()
    const found = installed.find((v) => v.version === version)
    if (!found) {
      throw new BedrockException({ type: 'bedrockVersionNotFound' },
        `Bedrock version ${version} is not installed locally.`)
    }
    return found
  }

  async switchVersion(version: string): Promise<void> {
    this.#assertSupported()
    const found = await this.#findInstalled(version)
    if (found.active) {
      return
    }
    // The game must not be running while (un)registering the package.
    await this.killGame()
    const family = this.#familyForType(found.type)
    try {
      await registerPackage(family, found.path)
    } catch (e) {
      if (e instanceof DeveloperModeRequiredError) {
        throw new BedrockException({ type: 'bedrockDeveloperModeRequired' },
          'Windows Developer Mode must be enabled to register this Bedrock version.', { cause: e })
      }
      throw new BedrockException({ type: 'bedrockRegisterFailed' },
        `Failed to register Bedrock version ${version}.`, { cause: e })
    }
    this.log(`Switched active Minecraft Bedrock version to ${version}`)
  }

  async launchVersion(version: string): Promise<void> {
    await this.switchVersion(version)
    await this.launch()
  }

  async removeVersion(version: string): Promise<void> {
    this.#assertSupported()
    const found = await this.#findInstalled(version)
    if (found.active) {
      await this.killGame()
      const family = this.#familyForType(found.type)
      await unregisterPackage(family, found.path).catch((e) => {
        this.warn(`Failed to unregister Bedrock version ${version}: ${e}`)
      })
    }
    await remove(found.path)
    this.log(`Removed Minecraft Bedrock version ${version}`)
  }

  async isDeveloperModeEnabled(): Promise<boolean> {
    if (this.app.platform.os !== 'windows') {
      return false
    }
    return isDeveloperModeEnabled().catch(() => false)
  }

  async enableDeveloperMode(): Promise<void> {
    this.#assertSupported()
    try {
      await enableDeveloperMode()
    } catch (e) {
      throw new BedrockException({ type: 'bedrockDeveloperModeRequired' },
        'Failed to enable Windows Developer Mode. Please enable it manually in Settings > For developers.', { cause: e })
    }
  }
}

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error
}
