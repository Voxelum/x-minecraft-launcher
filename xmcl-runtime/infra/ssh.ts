import { SSHCredentials } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import type { Client, SFTPWrapper } from 'ssh2'

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

  #key(options: Pick<SSHConnectOptions, 'host' | 'port' | 'username'>) {
    return `${options.username}@${options.host}:${options.port}`
  }

  async open(options: SSHConnectOptions) {
    const key = this.#key(options)
    if (key in this.#connections) {
      return this.#connections[key]
    }

    const { Client } = await import('ssh2')
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
        delete this.#connections[key]
      }).once('end', () => {
        delete this.#connections[key]
      }).once('error', (e) => {
        delete this.#connections[key]
        reject(e)
      })
    })

    this.#connections[key] = promise

    return await promise
  }

  /**
   * Close a cached connection (if any) for the given target. Safe to call
   * even if there is no open connection.
   */
  async close(options: Pick<SSHConnectOptions, 'host' | 'port' | 'username'>) {
    const key = this.#key(options)
    const promise = this.#connections[key]
    delete this.#connections[key]
    if (promise) {
      await promise.then((client) => client.end()).catch(() => undefined)
    }
  }

  /**
   * Run a one-shot command and collect its full stdout/stderr.
   */
  async exec(client: Client, command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, channel) => {
        if (err) {
          reject(err)
          return
        }
        let stdout = ''
        let stderr = ''
        channel.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8')
        })
        channel.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf-8')
        })
        channel.on('close', (code: number | null) => {
          resolve({ stdout, stderr, code })
        })
        channel.on('error', reject)
      })
    })
  }

  /**
   * Run a long-lived command (e.g. `tail -f`), streaming decoded chunks of
   * stdout+stderr to `onData` until `close()` is called on the returned
   * handle or the remote end closes the channel.
   */
  async execStream(client: Client, command: string, onData: (chunk: string) => void): Promise<{ close: () => void }> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, channel) => {
        if (err) {
          reject(err)
          return
        }
        channel.on('data', (data: Buffer) => onData(data.toString('utf-8')))
        channel.stderr.on('data', (data: Buffer) => onData(data.toString('utf-8')))
        resolve({
          close: () => {
            channel.close()
          },
        })
      })
    })
  }
}

export interface SSHConnectOptions {
  host: string
  port: number
  username: string
  credentials: SSHCredentials
}

