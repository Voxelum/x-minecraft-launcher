import { createPromiseSignal } from '@xmcl/runtime-api'
import { writeFile } from 'fs-extra'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { PassThrough } from 'stream'
import { extract } from 'tar-stream'
import { stream } from 'undici'
import { createGunzip } from 'zlib'
import { AnyError } from '../util/error'

export class NativeModuleLoader<T> {
  #retryCount = 0
  #signal = createPromiseSignal<T>()
  #initPromise: Promise<void> | undefined

  constructor(
    readonly nodeFileName: string,
    readonly getUrl: () => [string, string],
    readonly loader: (root: string, mod: any) => T,
  ) { }

  #tryResolve = async (root: string): Promise<void> => {
    try {
      const nativeModule = getDependencyIfExists(root, this.nodeFileName)
      const result = this.loader(root, nativeModule)
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

  const unzip = createGunzip()
  const extractStream = extract()
  unzip.pipe(extractStream)

  const download = (u: string) => stream(u, { opaque: { unzip }, method: 'GET' }, ({ opaque, headers, statusCode }) => {
    if (statusCode === 200) return (opaque as any).unzip
    Object.assign(opaque as any, {
      failed: true,
      headers,
      statusCode,
    })
    return new PassThrough()
  })

  const { opaque } = await download(primary)

  if ((opaque as any).failed) {
    const { opaque } = await download(fallback)

    if ((opaque as any).failed) {
      throw new AnyError('NativeDownloadError', 'Failed to download ' + fileName)
    }
  }

  for await (const e of extractStream) {
    if (e.header.name.endsWith(fileName)) {
      const bufs = [] as Buffer[]
      for await (const d of e) {
        bufs.push(d)
      }
      await writeFile(dest, Buffer.concat(bufs))
    }
  }

  return dest
}
