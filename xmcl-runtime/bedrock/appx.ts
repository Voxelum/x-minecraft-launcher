import { execFile, spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { ensureDir, remove } from 'fs-extra'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'

const execFileAsync = promisify(execFile)

/**
 * Error thrown when registering a loose package fails because Windows
 * Developer Mode is not enabled.
 */
export class DeveloperModeRequiredError extends Error {
  constructor() {
    super('Windows Developer Mode is required to register the package.')
    this.name = 'DeveloperModeRequiredError'
  }
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
  ], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  return stdout.toString()
}

/**
 * Extract an `.appx` package (a zip archive) into `destination`, then delete
 * the code-signing file so Windows will accept it as a loose/registered
 * package. Mirrors the reference launcher's `ExtractAppx`.
 */
export async function extractAppx(appxPath: string, destination: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  const zip = await open(appxPath)
  const entries = await readAllEntries(zip)
  const total = entries.length
  let done = 0
  for (const entry of entries) {
    const fileName = entry.fileName
    // Skip directory entries.
    if (fileName.endsWith('/')) {
      done++
      continue
    }
    const target = join(destination, fileName)
    await ensureDir(dirname(target))
    const readable = await openEntryReadStream(zip, entry)
    await pipeline(readable, createWriteStream(target))
    done++
    onProgress?.(done, total)
  }
  // The signature file must be removed for a loose (unsigned) registration.
  await remove(join(destination, 'AppxSignature.p7x')).catch(() => undefined)
}

/**
 * The install location of the package currently registered under the given
 * family, or `undefined` when none is registered.
 */
export async function getRegisteredInstallLocation(packageFamily: string): Promise<string | undefined> {
  const name = packageFamily.split('_')[0]
  const script = '$ErrorActionPreference=\'SilentlyContinue\';' +
    `$p = Get-AppxPackage -Name ${name} | Select-Object -First 1;` +
    'if ($p) { Write-Output $p.InstallLocation }'
  const out = (await runPowerShell(script)).trim()
  return out || undefined
}

/**
 * Register a previously extracted package directory with Windows so it becomes
 * the active (launchable) package for its family. Any other package of the
 * same family (registered from a different location) is removed first, because
 * Windows only allows one registration per family per user.
 *
 * @throws {@link DeveloperModeRequiredError} when registration is blocked by
 * the absence of Developer Mode.
 */
export async function registerPackage(packageFamily: string, gameDir: string): Promise<void> {
  const name = packageFamily.split('_')[0]
  const manifest = join(gameDir, 'AppxManifest.xml')
  // Remove any existing registration that does not already point at gameDir,
  // then register the target directory. Emit a sentinel token on success so we
  // can distinguish a clean run from a swallowed error.
  const script =
    '$ErrorActionPreference=\'Stop\';' +
    'try {' +
    `  $pkgs = Get-AppxPackage -Name ${name};` +
    '  foreach ($p in $pkgs) {' +
    `    if ($p.InstallLocation -ne '${gameDir.replace(/'/g, "''")}') {` +
    '      Remove-AppxPackage -Package $p.PackageFullName;' +
    '    }' +
    '  }' +
    `  Add-AppxPackage -Register '${manifest.replace(/'/g, "''")}' -ForceApplicationShutdown;` +
    '  Write-Output \'XMCL_REGISTER_OK\';' +
    '} catch {' +
    '  Write-Output ("XMCL_REGISTER_ERR:" + $_.Exception.Message);' +
    '}'
  const out = (await runPowerShell(script)).trim()
  if (out.includes('XMCL_REGISTER_OK')) {
    return
  }
  const lower = out.toLowerCase()
  // 0x80073CFF: a valid developer license / developer mode is required.
  if (lower.includes('0x80073cff') || lower.includes('developer')) {
    throw new DeveloperModeRequiredError()
  }
  throw new Error(out.replace(/^XMCL_REGISTER_ERR:/, '') || 'Failed to register the Bedrock package.')
}

/**
 * Unregister (remove) the package currently registered from `gameDir`, if any.
 * The extracted files are left on disk.
 */
export async function unregisterPackage(packageFamily: string, gameDir: string): Promise<void> {
  const name = packageFamily.split('_')[0]
  const script =
    '$ErrorActionPreference=\'SilentlyContinue\';' +
    `$pkgs = Get-AppxPackage -Name ${name};` +
    'foreach ($p in $pkgs) {' +
    `  if ($p.InstallLocation -eq '${gameDir.replace(/'/g, "''")}') {` +
    '    Remove-AppxPackage -Package $p.PackageFullName;' +
    '  }' +
    '}'
  await runPowerShell(script)
}

const DEV_MODE_KEY = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock'

/**
 * Whether Windows Developer Mode (required to register loose packages) is
 * currently enabled.
 */
export async function isDeveloperModeEnabled(): Promise<boolean> {
  const script = '$ErrorActionPreference=\'SilentlyContinue\';' +
    `$v = (Get-ItemProperty -Path '${DEV_MODE_KEY}' -Name AllowDevelopmentWithoutDevLicense).AllowDevelopmentWithoutDevLicense;` +
    'Write-Output $v'
  const out = (await runPowerShell(script)).trim()
  return out === '1'
}

/**
 * Attempt to enable Windows Developer Mode by writing the required `HKLM`
 * registry value from an elevated PowerShell process (triggers a UAC prompt).
 * Rejects if the user declines elevation or the elevated process fails.
 */
export async function enableDeveloperMode(): Promise<void> {
  // The inner command runs elevated and sets the registry value.
  const inner =
    `New-Item -Path '${DEV_MODE_KEY}' -Force | Out-Null; ` +
    `Set-ItemProperty -Path '${DEV_MODE_KEY}' -Name AllowDevelopmentWithoutDevLicense -Value 1 -Type DWord`
  // Base64-encode the inner command so quoting survives the round-trip.
  const encoded = Buffer.from(inner, 'utf16le').toString('base64')
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
      `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}'`,
    ], { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Failed to enable Developer Mode (exit ${code}). ${stderr}`))
    })
  })
}

/**
 * Read the version string declared in an extracted package's `AppxManifest.xml`.
 */
export async function readPackageVersion(gameDir: string): Promise<string | undefined> {
  try {
    const { readFile } = await import('fs-extra')
    const xml = await readFile(join(gameDir, 'AppxManifest.xml'), 'utf-8')
    const match = xml.match(/<Identity[^>]*\bVersion="([^"]+)"/)
    return match?.[1]
  } catch {
    return undefined
  }
}
