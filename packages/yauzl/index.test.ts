import { describe, expect, test } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Readable } from 'stream'
import { open as yopen, fromBuffer as yfromBuffer, readEntry as _unused, Entry, ZipFile, ZipFileOptions } from './index'

function open(path: string) {
  return new Promise<ZipFile>((resolve, reject) => {
    yopen(path, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err || !zip) reject(err); else resolve(zip)
    })
  })
}

function openReadStream(zip: ZipFile, entry: Entry, options?: ZipFileOptions): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, s: Readable) => err ? reject(err) : resolve(s)
    if (options) zip.openReadStream(entry, options, cb)
    else zip.openReadStream(entry, cb)
  })
}

async function readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
  const stream = await openReadStream(zip, entry)
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return Buffer.concat(chunks as unknown as Uint8Array[])
}

async function walkEntries(zip: ZipFile, handler: (e: Entry) => Promise<void> | void): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    zip.on('entry', async (e: Entry) => {
      try {
        await handler(e)
        zip.readEntry()
      } catch (err) { reject(err) }
    })
    zip.on('end', () => resolve())
    zip.on('error', reject)
    zip.readEntry()
  })
}

describe('@xmcl/yauzl', () => {
  test('opens a standard yauzl-compatible archive (smoke)', async () => {
    // This package is API-identical to upstream yauzl 2.10.0; we only need
    // to verify that the fix for ZIP64-with-0xFFFF-disk-number does not
    // regress regular archives.
    const zip = await open(join(__dirname, 'mock', 'sample-pack-squash.zip'))
    expect(zip).toBeDefined()
    zip.close()
  })

  describe('PackSquash ZIP64 quirk (regression)', () => {
    test('accepts an archive whose legacy EOCDR reports disk number 0xFFFF', async () => {
      // Upstream yauzl 2.10.0 rejects this file with
      //   "multi-disk zip files are not supported: found disk number: 65535"
      // because PackSquash sets the legacy "number of this disk" field to
      // the ZIP64 sentinel 0xFFFF while storing the real value (0) in the
      // ZIP64 EOCDR.
      const zip = await open(join(__dirname, 'mock', 'sample-pack-squash.zip'))
      const entries: string[] = []
      await walkEntries(zip, (e) => {
        entries.push(e.fileName)
      })
      expect(entries).toContain('pack.mcmeta')
    })

    test('can read entry contents from a PackSquash archive', async () => {
      const zip = await open(join(__dirname, 'mock', 'sample-pack-squash.zip'))
      let mcmeta: Buffer | undefined
      await walkEntries(zip, async (e) => {
        if (e.fileName === 'pack.mcmeta') {
          mcmeta = await readEntry(zip, e)
        }
      })
      expect(mcmeta).toBeDefined()
      const parsed = JSON.parse(mcmeta!.toString('utf-8'))
      expect(parsed.pack.pack_format).toEqual(15)
    })

    test('triggers ZIP64 parsing when only diskNumber field is sentinel and yields real entry count', async () => {
      // Synthesise a valid single-entry archive whose legacy EOCDR has
      //   diskNumber = 0xFFFF, entryCount = 1, cdOffset = real
      // and which carries a real ZIP64 EOCDR/EOCDL (disk 0, entryCount 1).
      // Without our fix, the upstream trigger condition
      //   entryCount === 0xffff || cdOffset === 0xffffffff
      // would not fire and yauzl would silently report 0 entries.
      const base = readFileSync(join(__dirname, 'mock', 'sample-pack-squash.zip'))
      // Layout of base: [LFH+data 0..93][CD 94..150][EOCDR 151..172]
      const cdOffset = base.readUInt32LE(151 + 16)
      const cdSize = base.readUInt32LE(151 + 12)
      const entryCount = base.readUInt16LE(151 + 10)
      // ZIP64 EOCDR (56 bytes)
      const z64eocdr = Buffer.alloc(56)
      z64eocdr.writeUInt32LE(0x06064b50, 0)         // signature
      z64eocdr.writeBigUInt64LE(BigInt(44), 4)      // size of EOCDR - 12
      z64eocdr.writeUInt16LE(45, 12)                // version made by
      z64eocdr.writeUInt16LE(45, 14)                // version needed
      z64eocdr.writeUInt32LE(0, 16)                 // this disk
      z64eocdr.writeUInt32LE(0, 20)                 // disk w/ CD
      z64eocdr.writeBigUInt64LE(BigInt(entryCount), 24)
      z64eocdr.writeBigUInt64LE(BigInt(entryCount), 32)
      z64eocdr.writeBigUInt64LE(BigInt(cdSize), 40)
      z64eocdr.writeBigUInt64LE(BigInt(cdOffset), 48)
      // ZIP64 EOCDL (20 bytes), points to the ZIP64 EOCDR we just built
      const z64eocdl = Buffer.alloc(20)
      z64eocdl.writeUInt32LE(0x07064b50, 0)         // signature
      z64eocdl.writeUInt32LE(0, 4)                  // disk w/ ZIP64 EOCDR
      z64eocdl.writeBigUInt64LE(BigInt(151), 8)     // offset of ZIP64 EOCDR
      z64eocdl.writeUInt32LE(1, 16)                 // total disks
      // Legacy EOCDR (22 bytes) with diskNumber set to the sentinel
      const legacy = Buffer.from(base.subarray(151, 173))
      legacy.writeUInt16LE(0xffff, 4)
      const synth = Buffer.concat([
        base.subarray(0, 151),
        z64eocdr,
        z64eocdl,
        legacy,
      ])
      const zip = await new Promise<ZipFile>((resolve, reject) => {
        yfromBuffer(synth, { lazyEntries: true }, (err, z) => err ? reject(err) : resolve(z))
      })
      const entries: string[] = []
      await walkEntries(zip, (e) => { entries.push(e.fileName) })
      expect(entries).toEqual(['pack.mcmeta'])
    })

    test('falls back to lenient CD-scan when EOCDR signals ZIP64 but no EOCDL is present (Minecraft-compatible)', async () => {
      // Some resource packs (observed in the wild, e.g. paid Chinese PBR
      // packs) have a legacy EOCDR with diskNumber=0xFFFF (or another
      // sentinel) AND a lying entryCount=0, but NO ZIP64 EOCDR/EOCDL. The
      // Minecraft client loads such packs because java.util.zip walks the
      // central directory by bytes, ignoring entryCount. We mirror that
      // behaviour: scan from cdOffset for cdSize bytes, terminating on a
      // non-CDFH signature so we don't read past the CD.
      const base = readFileSync(join(__dirname, 'mock', 'sample-pack-squash.zip'))
      const malformed = Buffer.from(base)
      malformed.writeUInt16LE(0xffff, 151 + 4) // diskNumber sentinel
      malformed.writeUInt16LE(0, 151 + 8)      // entriesThisDisk = 0 (lie)
      malformed.writeUInt16LE(0, 151 + 10)     // totalEntries     = 0 (lie)
      // cdOffset (94) and cdSize (57) stay truthful — these are the only
      // fields lenient mode trusts.
      const dir = join(tmpdir(), 'xmcl-yauzl-test')
      mkdirSync(dir, { recursive: true })
      const p = join(dir, 'lenient.zip')
      writeFileSync(p, malformed)
      const zip = await open(p)
      const entries: string[] = []
      await walkEntries(zip, (e) => { entries.push(e.fileName) })
      expect(entries).toContain('pack.mcmeta')
    })

    test('lenient mode still rejects when even cdOffset is sentinel', async () => {
      // If both diskNumber AND cdOffset are sentinels with no ZIP64
      // structures, we genuinely cannot recover — surface an error.
      const base = readFileSync(join(__dirname, 'mock', 'sample-pack-squash.zip'))
      const malformed = Buffer.from(base)
      malformed.writeUInt16LE(0xffff, 151 + 4)        // diskNumber sentinel
      malformed.writeUInt32LE(0xffffffff, 151 + 16)   // cdOffset sentinel
      const dir = join(tmpdir(), 'xmcl-yauzl-test')
      mkdirSync(dir, { recursive: true })
      const p = join(dir, 'malformed-unrecoverable.zip')
      writeFileSync(p, malformed)
      await expect(open(p)).rejects.toThrow(/malformed zip: EOCDR signals ZIP64/)
    })
  })
})
