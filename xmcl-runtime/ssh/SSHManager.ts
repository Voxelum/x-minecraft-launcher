import { SSHCredentials } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { Client, SFTPWrapper } from 'ssh2'
import { InjectionKey } from '~/app'

export const kSSHManager: InjectionKey<SSHManager> = Symbol('SSHManager')

export class SSHManager {
  #connections: Record<string, Promise<Client>> = {}

  #sftp: WeakMap<Client, SFTPWrapper> = new WeakMap()

  async openSFTP(client: Client) {
    if (this.#sftp.has(client)) {
      return this.#sftp.get(client)
    }
    return new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err)
        } else {
          this.#sftp.set(client, sftp)
          resolve(sftp)
        }
      })
    })
  }

  async #getPrivateKeyBuff(cred: SSHCredentials) {
    if ('privateKey' in cred) {
      const content = await readFile(cred.privateKey)
      return Buffer.from(content)
    }
    return undefined

  }

  async open(options: SSHConnectOptions) {
    if (options.host in this.#connections) {
      return this.#connections[options.host]
    }

    const client = new Client()

    const privateKey = await this.#getPrivateKeyBuff(options.credentials)

    const promise = new Promise<Client>((resolve, reject) => {
      client.on('ready', () => {
        resolve(client)
      }).connect({
        host: options.host,
        port: options.port,
        username: options.username,
        password: 'password' in options.credentials ? options.credentials.password : undefined,
        privateKey,
        passphrase: 'passphrase' in options.credentials ? options.credentials.passphrase : undefined
      })

      client.once('timeout', () => {
        delete this.#connections[options.host]
      }).once('end', () => {
        delete this.#connections[options.host]
      }).once('error', (e) => {
        delete this.#connections[options.host]
        reject(e)
      })
    })

    this.#connections[options.host] = promise

    return await promise
  }
}

export interface SSHConnectOptions {
  host: string
  port: number
  username: string
  credentials: SSHCredentials
}
