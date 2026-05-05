/**
 * @module @xmcl/unzip
 */
import { Readable } from 'stream'
import { Entry, fromBuffer, fromFd, open as yopen, ZipFile, ZipFileOptions, Options } from 'yauzl'

export type OpenTarget = string | Buffer | number

/**
 * Open a yauzl zip
 * @param target The zip path or buffer or file descriptor
 * @param options The option to open
 */
export async function open(
  target: OpenTarget,
  options: Options = { lazyEntries: true, autoClose: false },
) {
  try {
    return await new Promise<ZipFile>((resolve, reject) => {
      function handleZip(err: Error | null, zipfile: ZipFile | null) {
        if (err || !zipfile) {
          reject(err)
        } else {
          resolve(zipfile)
        }
      }
      if (typeof target === 'string') {
        yopen(target, options, handleZip)
      } else if (target instanceof Buffer) {
        fromBuffer(target, options, handleZip)
      } else {
        fromFd(target as number, options, handleZip)
      }
    })
  } catch (e) {
    if (!e) {
      throw Object.assign(new Error('Fail to open zip file'), { name: 'InvalidZipFile' })
    }
    if ((e as any).message === 'end of central directory record signature not found') {
      throw Object.assign(new Error('Invalid zip file'), { name: 'InvalidZipFile' })
    }
    throw e
  }
}

/**
 * Open the entry readstream for the zip file
 * @param zip The zip file object
 * @param entry The entry to open
 * @param options The options to open stream
 */
export function openEntryReadStream(zip: ZipFile, entry: Entry, options?: ZipFileOptions) {
  return new Promise<Readable>((resolve, reject) => {
    function handleStream(err: Error | null, stream: Readable | null) {
      if (err || !stream) {
        reject(err)
      } else {
        resolve(stream)
      }
    }
    if (options) {
      zip.openReadStream(entry, options, handleStream)
    } else {
      zip.openReadStream(entry, handleStream)
    }
  })
}

/**
 * Read the entry to buffer
 * @param zip The zip file object
 * @param entry The entry to open
 * @param options The options to open stream
 */
export async function readEntry(zip: ZipFile, entry: Entry, options?: ZipFileOptions) {
  const stream = await openEntryReadStream(zip, entry, options)
  const buffers: Buffer[] = []
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      buffers.push(chunk)
    })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  return Buffer.concat(buffers as unknown as Uint8Array[])
}

/**
 * Get the async entry generator for the zip file
 * @param zip The zip file
 */
export async function* walkEntriesGenerator(
  zip: ZipFile,
): AsyncGenerator<Entry, void, boolean | undefined> {
  let ended = false
  let error: any
  let resume: (v?: any) => void = () => {}
  let wait = new Promise<void>((resolve) => {
    resume = resolve
  })
  const entries: Entry[] = []
  const onEntry = (e: Entry) => {
    entries.push(e)
    resume()
  }
  const onEnd = () => {
    ended = true
    resume()
  }
  const onError = (e: any) => {
    error = e
    resume()
  }

  zip.addListener('entry', onEntry).addListener('end', onEnd).addListener('error', onError)

  try {
    while (!ended) {
      if (zip.lazyEntries) {
        zip.readEntry()
      }
      await wait
      // if error, throw error
      if (error) {
        throw error
      }
      // if entries read, yield entries
      while (entries.length > 0 && !ended) {
        ended = !!(yield entries.pop()!)
      }
      // reset wait
      wait = new Promise<void>((resolve) => {
        resume = resolve
      })
    }
  } finally {
    zip
      .removeListener('entry', onEntry)
      .removeListener('end', onEnd)
      .removeListener('error', onError)
  }
}

/**
 * Walk all the entries of the zip and once provided entries are all found, then terminate the walk process
 * @param zip The zip file
 * @param entries The entry to read
 */
export async function filterEntries(
  zip: ZipFile,
  entries: Array<string | ((entry: Entry) => boolean)>,
): Promise<(Entry | undefined)[]> {
  const bags = entries.map((e) => [e, undefined as undefined | Entry] as const)
  let remaining = entries.length
  for await (const entry of walkEntriesGenerator(zip)) {
    for (const bag of bags) {
      if (typeof bag[0] === 'string') {
        if (bag[0] === entry.fileName) {
          // @ts-ignore
          bag[1] = entry
          remaining -= 1
        }
      } else {
        if (bag[0](entry)) {
          // @ts-ignore
          bag[1] = entry
          remaining -= 1
        }
      }
      if (remaining === 0) break
    }
  }
  return bags.map((b) => b[1])
}

/**
 * Walk all the entries of a unread zip file
 * @param zip The unread zip file
 * @param entryHandler The handler to recieve entries. Return true or Promise<true> to stop the walk
 */
export async function walkEntries(
  zip: ZipFile,
  entryHandler: (entry: Entry) => Promise<boolean> | boolean | void,
) {
  const itr = walkEntriesGenerator(zip)
  for await (const entry of itr) {
    const result = await entryHandler(entry)
    if (result) {
      break
    }
  }
}

export function getEntriesRecord(entries: Entry[]): Record<string, Entry> {
  const record: Record<string, Entry> = {}
  for (const entry of entries) {
    record[entry.fileName] = entry
  }
  return record
}

/**
 * Walk all entries of the zip file
 * @param zipFile The zip file object
 */
export async function readAllEntries(zipFile: ZipFile) {
  const entries: Entry[] = []
  for await (const entry of walkEntriesGenerator(zipFile)) {
    entries.push(entry)
  }
  return entries
}
