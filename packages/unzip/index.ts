/**
 * @module @xmcl/unzip
 */
import { Readable } from 'stream'
import { inflateRawSync } from 'zlib'
import { Entry, fromBuffer, fromFd, open as yopen, ZipFile, ZipFileOptions, Options } from '@xmcl/yauzl'

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

/** Per-entry memo of the resolved absolute offset of the file data. */
const kDataStart = Symbol('xmcl.dataStart')

function readerRead(reader: { read(b: Buffer, o: number, l: number, p: number, cb: (e: Error | null) => void): void }, buffer: Buffer, position: number, length: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (length === 0) { resolve(); return }
    reader.read(buffer, 0, length, position, (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * Read an entry into a single `Buffer` using a positional read plus a
 * synchronous inflate, avoiding the per-entry `ReadStream` + zlib `Transform`
 * pipeline that {@link readEntry} sets up. For the common case of many small
 * entries (block textures, models, lang files) this is several times faster.
 *
 * Positional reads do not share a file cursor, so concurrent calls on the same
 * `zip` are safe. Falls back to the streaming {@link readEntry} for encrypted
 * entries or compression methods other than store/deflate.
 *
 * @param zip The zip file object
 * @param entry The entry to read
 */
export async function readEntryBuffered(zip: ZipFile, entry: Entry): Promise<Buffer> {
  const method = entry.compressionMethod
  if (entry.isEncrypted() || (method !== 0 && method !== 8)) {
    return readEntry(zip, entry)
  }
  const reader = (zip as unknown as { reader: Parameters<typeof readerRead>[0] }).reader

  // The local file header's name/extra lengths can legally differ from the
  // central directory, so the data offset must be derived from the 30-byte
  // local header. It never changes, so memoize it on the entry.
  let dataStart: number | undefined = (entry as any)[kDataStart]
  if (dataStart === undefined) {
    const header = Buffer.allocUnsafe(30)
    await readerRead(reader, header, entry.relativeOffsetOfLocalHeader, 30)
    if (header.readUInt32LE(0) !== 0x04034B50) {
      // Unexpected signature: defer to the robust streaming reader.
      return readEntry(zip, entry)
    }
    const fileNameLength = header.readUInt16LE(26)
    const extraFieldLength = header.readUInt16LE(28)
    dataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength
    ;(entry as any)[kDataStart] = dataStart
  }

  const compressed = Buffer.allocUnsafe(entry.compressedSize)
  await readerRead(reader, compressed, dataStart, entry.compressedSize)
  return method === 0 ? compressed : inflateRawSync(compressed)
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
