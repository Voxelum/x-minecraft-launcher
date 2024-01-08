import { SecretStorage } from '@xmcl/runtime/app'
import { safeStorage } from 'electron'
import { ensureDir, readFile, unlink, writeFile } from 'fs-extra'
import { deletePassword, getPassword, setPassword } from 'keytar'

function encrypt(s: string) {
  try {
    return safeStorage.encryptString(s)
  } catch {
    return s
  }
}

function decrypt(s: Buffer) {
  try {
    return safeStorage.decryptString(s)
  } catch {
    return s.toString('utf-8')
  }
}

export class ElectronSecretStorage implements SecretStorage {
  constructor(private fallbackDir: string) {}

  async get(service: string, account: string): Promise<string | undefined> {
    try {
      return (await getPassword(service, account) || undefined)
    } catch (e) {
      return await readFile(this.fallbackDir).then(decrypt, () => undefined)
    }
  }

  async put(service: string, account: string, value: string): Promise<void> {
    if (value) {
      try {
        await setPassword(service, account, value)
      } catch {
        await ensureDir(this.fallbackDir)
        await writeFile(this.fallbackDir, encrypt(value)).catch(() => undefined)
      }
    } else {
      try {
        await deletePassword(service, account)
      } catch {
        await unlink(this.fallbackDir).catch(() => undefined)
      }
    }
  }
}
