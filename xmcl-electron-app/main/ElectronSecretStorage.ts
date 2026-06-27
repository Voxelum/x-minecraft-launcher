import { SecretStorage } from '@xmcl/runtime/app'
import { safeStorage } from 'electron'
import filenamify from 'filenamify'
import { ensureDir, readFile, unlink, writeFile } from 'fs-extra'
import { join } from 'path'

// 4-byte format markers prefixed to every stored blob so a read knows how the
// data was written, independent of the current state of the OS keyring. This
// is what makes us resilient to a backend that worked when we wrote but is
// broken when we read (e.g. a broken KWallet on KDE -- see the Linux
// "account expired after every restart" bug).
const MARKER_ENC = Buffer.from('ENC1') // safeStorage-encrypted payload follows
const MARKER_RAW = Buffer.from('RAW1') // plaintext UTF-8 payload follows
const MARKER_LEN = 4

function getBackend() {
  try {
    // Only meaningful on Linux; returns 'basic_text' | 'gnome_libsecret' |
    // 'kwallet' | 'kwallet5' | 'kwallet6' | 'unknown'.
    return process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function'
      ? safeStorage.getSelectedStorageBackend()
      : 'n/a'
  } catch {
    return 'unknown'
  }
}

/**
 * Probe whether `safeStorage` can actually round-trip a value RIGHT NOW.
 *
 * `safeStorage.isEncryptionAvailable()` is not enough: on a KDE system with a
 * broken/locked KWallet it can still report `true` while `encryptString` /
 * `decryptString` throw (or the derived key is unusable). So we additionally
 * encrypt a probe string and decrypt it back, and only trust encryption if the
 * round-trip matches.
 */
function probeHealthy(): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false
    const probe = 'xmcl-safe-storage-probe'
    const decrypted = safeStorage.decryptString(safeStorage.encryptString(probe))
    return decrypted === probe
  } catch {
    return false
  }
}

export class ElectronSecretStorage implements SecretStorage {
  /** Cached result of the health probe. Recomputed lazily on first use. */
  private healthy?: boolean

  /**
   * Live predicate that returns `true` when encryption should be
   * force-disabled (every value written as plaintext `RAW1`, bypassing
   * `safeStorage`). Driven by the `safeStorageEncryption` flight: turning that
   * flight off lets a user (or us, remotely) opt a broken-keyring machine out
   * of encryption without a rebuild. It is a live getter because the flight
   * store is populated asynchronously after this storage is constructed.
   * Reads still honor the per-blob marker, so existing `ENC1` data is still
   * decrypted when possible.
   */
  private isEncryptionDisabled?: () => boolean

  constructor(private dir: string) {}

  /**
   * Wire the force-plaintext predicate. Called once the `kFlights` store is
   * available (see ElectronLauncherApp).
   */
  setEncryptionDisabledProvider(provider: () => boolean) {
    this.isEncryptionDisabled = provider
  }

  private ensureHealthy(): boolean {
    if (this.isEncryptionDisabled?.()) return false
    if (this.healthy === undefined) {
      this.healthy = probeHealthy()
      // eslint-disable-next-line no-console
      console.log(`[SecretStorage] safeStorage healthy=${this.healthy} backend=${getBackend()}`)
    }
    return this.healthy
  }

  async get(service: string, account: string): Promise<string | undefined> {
    const key = filenamify(service + '@' + account)
    const buf = await readFile(join(this.dir, key)).catch(() => undefined)
    if (!buf) return undefined

    const marker = buf.subarray(0, MARKER_LEN)
    if (marker.equals(MARKER_RAW)) {
      // Stored as plaintext (keyring was unhealthy when written).
      return buf.subarray(MARKER_LEN).toString('utf-8')
    }
    if (marker.equals(MARKER_ENC)) {
      // Stored encrypted. Decrypt only; never fall back to plaintext, as that
      // would surface ciphertext bytes as a bogus token.
      try {
        return safeStorage.decryptString(buf.subarray(MARKER_LEN))
      } catch {
        return undefined
      }
    }
    // Legacy blob with no marker: written by an older build as a raw
    // safeStorage buffer. Try to decrypt for backward compatibility.
    try {
      return safeStorage.decryptString(buf)
    } catch {
      return undefined
    }
  }

  async put(service: string, account: string, value: string): Promise<void> {
    const key = filenamify(service + '@' + account)
    const file = join(this.dir, key)
    if (!value) {
      await unlink(file).catch(() => undefined)
      return
    }

    await ensureDir(this.dir)
    let data: Buffer | undefined
    if (this.ensureHealthy()) {
      try {
        data = Buffer.concat([MARKER_ENC, safeStorage.encryptString(value)])
      } catch {
        // Backend regressed since the probe (e.g. KWallet just went away).
        // Mark unhealthy and fall through to plaintext so we never write a
        // corrupt/half-encrypted blob.
        this.healthy = false
      }
    }
    if (!data) {
      data = Buffer.concat([MARKER_RAW, Buffer.from(value, 'utf-8')])
    }
    await writeFile(file, data).catch(() => undefined)
  }
}
