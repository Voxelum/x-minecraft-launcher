import { createPromiseSignal } from '@xmcl/runtime-api'
import { writeFileSync } from 'fs-extra'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { extract } from 'tar-stream'
import { gunzipSync } from 'zlib'
import { AnyError } from '../util/error'

export class NativeModuleLoader<T> {
  #retryCount = 0
  #signal = createPromiseSignal<T>()
  #initPromise: Promise<void> | undefined

  constructor(
    readonly nodeFileName: string,
    readonly getUrl: () => [string, string],
    readonly loader: (root: string, mod: any) => Promise<T>,
  ) { }

  #tryResolve = async (root: string): Promise<void> => {
    try {
      const nativeModule = getDependencyIfExists(root, this.nodeFileName)
      const result = await this.loader(root, nativeModule)
      this.#signal.resolve(result)
    } catch (e) {
      if (this.#retryCount > 3) {
        this.#signal.reject(new AnyError('NativeInitError', 'Failed to load ' + this.nodeFileName))
        return
      }
      await downloadNative(root, ...this.getUrl(), this.nodeFileName)
      this.#retryCount++
      return this.#tryResolve(root)
    }
  }

  init(root: string) {
    if (this.#initPromise) return this.#initPromise
    this.#initPromise = this.#tryResolve(root)
  }

  get retryCount() {
    return this.#retryCount
  }

  getInstance = () => {
    return this.#signal.promise
  }
}

function getDependencyIfExists(dir: string, fileName: string) {
  const dest = join(dir, fileName)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(dest)
    return mod
  } catch {
    unlink(dest).catch(() => { })
    return undefined
  }
}

async function downloadNative(dir: string, primary: string, fallback: string, fileName: string) {
  // Download the tarball and extract it to the specified directory
  const dest = join(dir, fileName)

  const download = (u: string) => fetch(u).then((res) => {
    if (!res.ok || !res.body) {
      throw new AnyError('NativeDownloadError', 'Failed to download ' + fileName)
    }
    return res.arrayBuffer()
  })

  const buf = await download(primary).catch(() => {
    return download(fallback)
  })

  const raw = gunzipSync(buf)

  const extractStream = extract()
  const bufs = [] as Buffer[]
  const singal = Promise.withResolvers<Buffer>()
  extractStream.on('entry', (header, stream, next) => {
    if (header.name.endsWith(fileName)) {
      stream.on('data', (buf) => {
        bufs.push(buf)
      })
      stream.on('end', () => {
        const buffer = Buffer.concat(bufs)
        singal.resolve(buffer)
      })
    }
    next()
  })

  extractStream.end(raw)

  writeFileSync(dest, await singal.promise)

  return dest
}
