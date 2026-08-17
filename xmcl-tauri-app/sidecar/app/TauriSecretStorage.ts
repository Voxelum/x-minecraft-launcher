import type { SecretStorage } from '@xmcl/runtime/app'
import { execFile } from 'child_process'
import { createDecipheriv, pbkdf2Sync } from 'crypto'
import filenamify from 'filenamify'
import { ensureDir, readFile, unlink, writeFile } from 'fs-extra'
import { join } from 'path'

/**
 * Same on-disk layout as `ElectronSecretStorage`: a 4-byte marker tells a read
 * how the blob was written, independently of the keyring's current health.
 * That is what makes the storage survive a backend that worked on write and is
 * broken on read (the Linux "account expired after every restart" bug).
 */
const MARKER_ENC = Buffer.from('ENC1') // the OS keyring holds the value
const MARKER_RAW = Buffer.from('RAW1') // plaintext UTF-8 payload follows
const MARKER_LEN = 4

interface Keyring {
  readonly name: string
  get(service: string, account: string): Promise<string | undefined>
  set(service: string, account: string, value: string): Promise<void>
  delete(service: string, account: string): Promise<void>
}

function exec(file: string, args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(file, args, { windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
    if (input !== undefined) {
      child.stdin?.end(input)
    }
  })
}

/**
 * `secret-tool` (libsecret) on Linux and `security` on macOS are the same
 * backends Electron's `safeStorage` used underneath, reached through their CLI
 * so the sidecar needs no native module. Windows has no such CLI, so DPAPI is
 * used through PowerShell and the ciphertext stays in our own file.
 */
function createKeyring(dir: string): Keyring | undefined {
  if (process.platform === 'linux') {
    return {
      name: 'libsecret',
      async get(service, account) {
        const out = await exec('secret-tool', ['lookup', 'service', service, 'account', account])
        return out || undefined
      },
      async set(service, account, value) {
        await exec('secret-tool', ['store', '--label', `${service}@${account}`, 'service', service, 'account', account], value)
      },
      async delete(service, account) {
        await exec('secret-tool', ['clear', 'service', service, 'account', account])
      },
    }
  }
  if (process.platform === 'darwin') {
    return {
      name: 'keychain',
      async get(service, account) {
        const out = await exec('security', ['find-generic-password', '-s', service, '-a', account, '-w'])
        return out.trimEnd() || undefined
      },
      async set(service, account, value) {
        await exec('security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w', value])
      },
      async delete(service, account) {
        await exec('security', ['delete-generic-password', '-s', service, '-a', account])
      },
    }
  }
  if (process.platform === 'win32') {
    // DPAPI, user scope: the same protection `safeStorage` uses on Windows.
    const protect = (value: string) =>
      exec('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName System.Security;' +
        '$b=[Convert]::FromBase64String($input | Out-String);' +
        '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,1))',
      ], Buffer.from(value, 'utf-8').toString('base64'))
    const unprotect = (value: string) =>
      exec('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName System.Security;' +
        '$b=[Convert]::FromBase64String($input | Out-String);' +
        '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,1))',
      ], value)
    // DPAPI only wraps the value; the ciphertext goes to a side file so the
    // marker file stays a pure marker on every platform.
    const sideFile = (service: string, account: string) =>
      join(dir, filenamify(service + '@' + account) + '.dpapi')
    return {
      name: 'dpapi',
      async get(service, account) {
        const wrapped = await readFile(sideFile(service, account), 'utf-8').catch(() => undefined)
        if (!wrapped) return undefined
        return Buffer.from((await unprotect(wrapped.trim())).trim(), 'base64').toString('utf-8')
      },
      async set(service, account, value) {
        await ensureDir(dir)
        await writeFile(sideFile(service, account), (await protect(value)).trim())
      },
      async delete(service, account) {
        await unlink(sideFile(service, account)).catch(() => undefined)
      },
    }
  }
  return undefined
}

/**
 * Read a blob Electron's `safeStorage` wrote, which is Chromium's `os_crypt`
 * format: `v10` followed by AES-128-CBC over a key derived from a password kept
 * in the OS keyring (`"<app name> Safe Storage"`), with the fixed salt and IV
 * Chromium uses. Without this, switching to the Tauri shell silently logged the
 * user out of every account.
 */
async function decryptElectron(payload: Buffer, appName: string): Promise<string | undefined> {
  if (process.platform === 'win32') {
    // `os_crypt` on Windows is DPAPI over the string itself, no version prefix.
    const out = await exec('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Security;' +
      '$b=[Convert]::FromBase64String($input | Out-String);' +
      '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,1))',
    ], payload.toString('base64')).catch(() => undefined)
    return out ? Buffer.from(out.trim(), 'base64').toString('utf-8') : undefined
  }

  const version = payload.subarray(0, 3).toString('ascii')
  if (version !== 'v10' && version !== 'v11') return undefined

  let iterations: number
  let stored: string | undefined
  if (process.platform === 'darwin') {
    iterations = 1003
    stored = (await exec('security', ['find-generic-password', '-s', `${appName} Safe Storage`, '-a', appName, '-w'])
      .catch(() => undefined))?.trimEnd()
  } else {
    iterations = 1
    stored = await exec('secret-tool', ['lookup', 'application', appName]).catch(() => undefined)
  }

  // The keyring may hold a password now while the blob was written by a run
  // that fell back to Chromium's `basic_text` backend (or the other way
  // around), so both candidates are tried.
  for (const password of [stored, 'peanuts']) {
    if (!password) continue
    const key = pbkdf2Sync(password, 'saltysalt', iterations, 16, 'sha1')
    const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '))
    try {
      return Buffer.concat([decipher.update(payload.subarray(3)), decipher.final()]).toString('utf-8')
    } catch {
      continue
    }
  }
  return undefined
}

export class TauriSecretStorage implements SecretStorage {
  private keyring?: Keyring | null

  constructor(
    private readonly dir: string,
    private readonly logger: Pick<Console, 'log' | 'warn'> = console,
    /** Electron's `app.getName()`, which keys its `safeStorage` password. */
    private readonly electronAppName = 'xmcl',
  ) {}

  async get(service: string, account: string): Promise<string | undefined> {
    const buf = await readFile(this.fileOf(service, account)).catch(() => undefined)
    if (!buf) return undefined

    const marker = buf.subarray(0, MARKER_LEN)
    if (marker.equals(MARKER_RAW)) {
      return buf.subarray(MARKER_LEN).toString('utf-8')
    }
    if (marker.equals(MARKER_ENC)) {
      if (buf.length > MARKER_LEN) {
        return await decryptElectron(buf.subarray(MARKER_LEN), this.electronAppName)
      }
      const keyring = await this.getKeyring()
      return await keyring?.get(service, account).catch(() => undefined)
    }
    // Marker-less blob: an old Electron build wrote the raw `safeStorage`
    // buffer.
    return await decryptElectron(buf, this.electronAppName)
  }

  async put(service: string, account: string, value: string): Promise<void> {
    const file = this.fileOf(service, account)
    if (!value) {
      await unlink(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      const keyring = await this.getKeyring()
      await keyring?.delete(service, account).catch(() => undefined)
      return
    }

    await ensureDir(this.dir)
    const keyring = await this.getKeyring()
    if (keyring) {
      try {
        await keyring.set(service, account, value)
        await writeFile(file, MARKER_ENC)
        return
      } catch (e) {
        // The backend regressed since the probe. Never leave a half-written
        // blob: mark it unusable and fall through to plaintext.
        this.logger.warn(`[SecretStorage] ${keyring.name} write failed, storing plaintext: ${(e as Error).message}`)
        this.keyring = null
      }
    }
    await writeFile(file, Buffer.concat([MARKER_RAW, Buffer.from(value, 'utf-8')]))
  }

  private fileOf(service: string, account: string) {
    return join(this.dir, filenamify(service + '@' + account))
  }

  private async getKeyring(): Promise<Keyring | undefined> {
    if (this.keyring !== undefined) return this.keyring ?? undefined
    if (process.env.XMCL_DISABLE_KEYRING) {
      this.keyring = null
      return undefined
    }
    const keyring = createKeyring(this.dir)
    if (!keyring) {
      this.keyring = null
      return undefined
    }
    try {
      // Round-trip probe: `secret-tool`/`security` may exist and still fail
      // (locked or absent keyring daemon), which `isEncryptionAvailable`-style
      // checks do not catch.
      const probe = 'xmcl-secret-storage-probe'
      await keyring.set('xmcl-probe', 'probe', probe)
      const read = await keyring.get('xmcl-probe', 'probe')
      await keyring.delete('xmcl-probe', 'probe').catch(() => undefined)
      if (read !== probe) throw new Error('round-trip mismatch')
      this.keyring = keyring
      this.logger.log(`[SecretStorage] using ${keyring.name}`)
    } catch (e) {
      this.logger.warn(`[SecretStorage] no usable keyring (${(e as Error).message}); secrets will be plaintext`)
      this.keyring = null
    }
    return this.keyring ?? undefined
  }
}
