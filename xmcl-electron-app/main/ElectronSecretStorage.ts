import { SecretStorage } from '@xmcl/runtime/app'
import { safeStorage } from 'electron'
import filenamify from 'filenamify'
import { ensureDir, readFile, unlink, writeFile } from 'fs-extra'
import { join } from 'path'

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
    return undefined
  }
}

export class ElectronSecretStorage implements SecretStorage {
  constructor(private dir: string) {}

  async get(service: string, account: string): Promise<string | undefined> {
    const key = filenamify(service + '@' + account)
    return await readFile(join(this.dir, key)).then(decrypt, () => undefined)
  }

  async put(service: string, account: string, value: string): Promise<void> {
    const key = filenamify(service + '@' + account)
    if (value) {
      await ensureDir(this.dir)
      await writeFile(join(this.dir, key), encrypt(value)).catch(() => undefined)
    } else {
      await unlink(join(this.dir, key)).catch(() => undefined)
    }
  }
}
