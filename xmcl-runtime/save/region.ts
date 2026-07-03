import { ensureDir, pathExists, readdir, readFile, stat, unlink, writeFile } from 'fs-extra'
import { join } from 'path'
import { deflateSync, gunzipSync, gzipSync, inflateSync } from 'zlib'
import { getBlockColor, TRANSPARENT_BLOCKS } from './blockColors'

export interface SaveRegionInfo {
  regionX: number
  regionZ: number
}

export interface RenderedRegion {
  regionX: number
  regionZ: number
  /**
   * RGBA pixel buffer of the 512x512 region image (top-down surface colors).
   */
  data: Uint8Array
  /**
   * Length 1024. Whether a chunk exists at local index `(x & 31) + (z & 31) * 32`.
   */
  chunks: boolean[]
}

const REGION_FILE = /^r\.(-?\d+)\.(-?\d+)\.mca$/

const DIMENSION_DIRS: Record<string, string> = {
  'minecraft:overworld': '.',
  'minecraft:the_nether': 'DIM-1',
  'minecraft:the_end': 'DIM1',
}

function getDimensionDir(savePath: string, dimension: string): string {
  const known = DIMENSION_DIRS[dimension]
  if (known) {
    return known === '.' ? savePath : join(savePath, known)
  }
  // Custom dimension: namespace:path -> dimensions/namespace/path
  const [namespace, path] = dimension.split(':')
  if (namespace && path) {
    return join(savePath, 'dimensions', namespace, ...path.split('/'))
  }
  return savePath
}

function getRegionDir(savePath: string, dimension: string): string {
  return join(getDimensionDir(savePath, dimension), 'region')
}

/**
 * List the dimensions that contain region data for a save.
 */
export async function listSaveDimensions(savePath: string): Promise<string[]> {
  const result: string[] = []
  for (const [dimension] of Object.entries(DIMENSION_DIRS)) {
    if (await pathExists(getRegionDir(savePath, dimension))) {
      result.push(dimension)
    }
  }
  // Custom datapack dimensions under `dimensions/<namespace>/<path>`
  const dimensionsRoot = join(savePath, 'dimensions')
  if (await pathExists(dimensionsRoot)) {
    const namespaces = await readdir(dimensionsRoot).catch(() => [])
    for (const namespace of namespaces) {
      const namespaceDir = join(dimensionsRoot, namespace)
      if (!(await stat(namespaceDir).then(s => s.isDirectory()).catch(() => false))) continue
      const paths = await readdir(namespaceDir).catch(() => [])
      for (const path of paths) {
        if (await pathExists(join(namespaceDir, path, 'region'))) {
          result.push(`${namespace}:${path}`)
        }
      }
    }
  }
  return result
}

/**
 * List the available region files (each covers 32x32 chunks) of a dimension.
 */
export async function getSaveRegions(savePath: string, dimension: string): Promise<SaveRegionInfo[]> {
  const dir = getRegionDir(savePath, dimension)
  const files = await readdir(dir).catch(() => [] as string[])
  const result: SaveRegionInfo[] = []
  for (const file of files) {
    const match = REGION_FILE.exec(file)
    if (match) {
      result.push({ regionX: Number(match[1]), regionZ: Number(match[2]) })
    }
  }
  return result
}

/**
 * Read a packed value from a Minecraft long array (read lazily from the raw
 * decompressed chunk buffer) using the post-1.16 non value-spanning scheme.
 *
 * Uses two 32-bit reads and integer bit math instead of BigInt — values are at
 * most 12 bits and never span a long, so this stays well within 32-bit range
 * and avoids the heavy BigInt allocations in the hot per-block path.
 */
function readPacked(raw: Buffer, byteOffset: number, longCount: number, bits: number, index: number): number {
  if (bits <= 0 || longCount === 0) return 0
  const valuesPerLong = Math.floor(64 / bits)
  const longIndex = Math.floor(index / valuesPerLong)
  if (longIndex >= longCount) return 0
  const bitStart = (index % valuesPerLong) * bits
  const byteBase = byteOffset + longIndex * 8
  const hi = raw.readUInt32BE(byteBase) // bits 63..32
  const lo = raw.readUInt32BE(byteBase + 4) // bits 31..0
  const mask = (1 << bits) - 1
  if (bitStart + bits <= 32) {
    return (lo >>> bitStart) & mask
  }
  if (bitStart >= 32) {
    return (hi >>> (bitStart - 32)) & mask
  }
  // The value straddles the 32-bit boundary between the two halves.
  const lowBits = 32 - bitStart
  const lowPart = lo >>> bitStart
  const highPart = (hi & ((1 << (bits - lowBits)) - 1)) << lowBits
  return (highPart | lowPart) & mask
}

interface DecodedSection {
  paletteNames: string[]
  /** Byte offset of the block-state long array in `raw`, or -1 if absent. */
  dataOffset: number
  /** Number of longs in the block-state array. */
  dataLen: number
  bits: number
  /** True when the whole section is a single block id (no per-block data). */
  uniform: boolean
  /** True when a uniform section's single block is transparent (e.g. air). */
  uniformTransparent: boolean
}

interface DecodedChunk {
  /** The decompressed chunk NBT buffer; long arrays are read lazily from it. */
  raw: Buffer
  sections: Map<number, DecodedSection>
  minSectionY: number
  maxSectionY: number
  /** Byte offset of MOTION_BLOCKING long array in `raw`, or -1 if absent. */
  heightmapOffset: number
  heightmapLen: number
  heightmapBits: number
}

// NBT tag ids.
const TAG_END = 0
const TAG_BYTE = 1
const TAG_INT = 3
const TAG_STRING = 8
const TAG_LIST = 9
const TAG_COMPOUND = 10
const TAG_LONG_ARRAY = 12

/**
 * A minimal cursor over a decompressed chunk NBT buffer. Instead of building a
 * full JS object tree (the dominant cost of a generic deserializer), it walks
 * the buffer and only materializes the handful of tags the map renderer needs;
 * everything else (entities, block entities, biomes, extra heightmaps) is
 * skipped by simply advancing the cursor.
 */
class ChunkNbtReader {
  pos = 0
  constructor(public readonly buf: Buffer) {}

  u8(): number { return this.buf[this.pos++] }
  i8(): number { const v = this.buf.readInt8(this.pos); this.pos += 1; return v }
  u16(): number { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v }
  i32(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v }

  str(): string {
    const len = this.u16()
    const s = this.buf.toString('utf8', this.pos, this.pos + len)
    this.pos += len
    return s
  }

  skipStr(): void { const len = this.u16(); this.pos += len }

  /** Advance the cursor past a payload of the given tag type without decoding it. */
  skip(type: number): void {
    switch (type) {
      case 1: this.pos += 1; break // byte
      case 2: this.pos += 2; break // short
      case 3: this.pos += 4; break // int
      case 4: this.pos += 8; break // long
      case 5: this.pos += 4; break // float
      case 6: this.pos += 8; break // double
      case 7: { const n = this.i32(); this.pos += n; break } // byte array
      case 8: { const n = this.u16(); this.pos += n; break } // string
      case 9: { // list
        const et = this.u8()
        const n = this.i32()
        for (let i = 0; i < n; i++) this.skip(et)
        break
      }
      case 10: this.skipCompound(); break // compound
      case 11: { const n = this.i32(); this.pos += n * 4; break } // int array
      case 12: { const n = this.i32(); this.pos += n * 8; break } // long array
      default: break
    }
  }

  skipCompound(): void {
    for (;;) {
      const t = this.u8()
      if (t === TAG_END) break
      this.skipStr()
      this.skip(t)
    }
  }

  /** Read a long-array header and skip its body; returns its offset and length. */
  readLongArrayRef(): { offset: number; len: number } {
    const len = this.i32()
    const offset = this.pos
    this.pos += len * 8
    return { offset, len }
  }
}

function parsePaletteEntry(r: ChunkNbtReader): string {
  let name = 'air'
  for (;;) {
    const t = r.u8()
    if (t === TAG_END) break
    const key = r.str()
    if (t === TAG_STRING && key === 'Name') {
      name = r.str()
    } else {
      r.skip(t)
    }
  }
  return name
}

function parsePalette(r: ChunkNbtReader): string[] {
  const et = r.u8()
  const n = r.i32()
  const names: string[] = []
  for (let i = 0; i < n; i++) {
    if (et === TAG_COMPOUND) {
      names.push(parsePaletteEntry(r))
    } else {
      r.skip(et)
    }
  }
  return names
}

function parseSection(r: ChunkNbtReader, out: DecodedChunk): void {
  let y = NaN
  let paletteNames: string[] | undefined
  let dataOffset = -1
  let dataLen = 0
  for (;;) {
    const t = r.u8()
    if (t === TAG_END) break
    const key = r.str()
    if (t === TAG_BYTE && key === 'Y') {
      y = r.i8()
    } else if (t === TAG_COMPOUND && key === 'block_states') {
      // Modern (1.18+) format.
      for (;;) {
        const tt = r.u8()
        if (tt === TAG_END) break
        const k2 = r.str()
        if (tt === TAG_LIST && k2 === 'palette') {
          paletteNames = parsePalette(r)
        } else if (tt === TAG_LONG_ARRAY && k2 === 'data') {
          const ref = r.readLongArrayRef()
          dataOffset = ref.offset
          dataLen = ref.len
        } else {
          r.skip(tt)
        }
      }
    } else if (t === TAG_LIST && key === 'Palette') {
      // 1.13-1.17 format.
      paletteNames = parsePalette(r)
    } else if (t === TAG_LONG_ARRAY && key === 'BlockStates') {
      const ref = r.readLongArrayRef()
      dataOffset = ref.offset
      dataLen = ref.len
    } else {
      r.skip(t)
    }
  }

  if (!paletteNames || paletteNames.length === 0 || Number.isNaN(y)) return
  if (y < out.minSectionY) out.minSectionY = y
  if (y > out.maxSectionY) out.maxSectionY = y
  const bits = Math.max(4, Math.ceil(Math.log2(paletteNames.length)))
  const uniform = dataOffset < 0 || paletteNames.length === 1
  const uniformTransparent = uniform && isTransparent(paletteNames[0] ?? 'air')
  out.sections.set(y, { paletteNames, dataOffset, dataLen, bits, uniform, uniformTransparent })
}

function parseSectionsList(r: ChunkNbtReader, out: DecodedChunk): void {
  const et = r.u8()
  const n = r.i32()
  for (let i = 0; i < n; i++) {
    if (et === TAG_COMPOUND) {
      parseSection(r, out)
    } else {
      r.skip(et)
    }
  }
}

function parseHeightmaps(r: ChunkNbtReader, out: DecodedChunk): void {
  for (;;) {
    const t = r.u8()
    if (t === TAG_END) break
    const key = r.str()
    if (t === TAG_LONG_ARRAY && key === 'MOTION_BLOCKING') {
      const ref = r.readLongArrayRef()
      out.heightmapOffset = ref.offset
      out.heightmapLen = ref.len
    } else {
      r.skip(t)
    }
  }
}

/** Walk a chunk-root compound body, extracting sections and the heightmap. */
function parseChunkBody(r: ChunkNbtReader, out: DecodedChunk): void {
  for (;;) {
    const t = r.u8()
    if (t === TAG_END) break
    const key = r.str()
    if (t === TAG_COMPOUND && key === 'Level') {
      // Pre-1.18 worlds nest chunk data under a `Level` compound.
      parseChunkBody(r, out)
    } else if (t === TAG_LIST && (key === 'sections' || key === 'Sections')) {
      parseSectionsList(r, out)
    } else if (t === TAG_COMPOUND && key === 'Heightmaps') {
      parseHeightmaps(r, out)
    } else {
      r.skip(t)
    }
  }
}

/**
 * Parse a decompressed chunk NBT buffer into the minimal structure the map
 * renderer needs, skipping all unused tags.
 */
function decodeChunk(raw: Buffer): DecodedChunk | undefined {
  const r = new ChunkNbtReader(raw)
  const rootType = r.u8()
  if (rootType !== TAG_COMPOUND) return undefined
  r.skipStr() // root compound name

  const out: DecodedChunk = {
    raw,
    sections: new Map(),
    minSectionY: Number.POSITIVE_INFINITY,
    maxSectionY: Number.NEGATIVE_INFINITY,
    heightmapOffset: -1,
    heightmapLen: 0,
    heightmapBits: 0,
  }
  parseChunkBody(r, out)

  if (out.sections.size === 0) return undefined
  if (out.heightmapLen > 0) {
    const valuesPerLong = Math.ceil(256 / out.heightmapLen)
    out.heightmapBits = Math.floor(64 / valuesPerLong)
  }
  return out
}

function isTransparent(name: string): boolean {
  const id = name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name
  return TRANSPARENT_BLOCKS.has(id)
}

/**
 * Resolve the surface block color and height for a single column of a chunk.
 *
 * Empty and uniformly-transparent (e.g. all-air) sections are skipped in O(1)
 * by jumping straight to the section below, so columns without a usable
 * heightmap no longer pay for scanning every air block from the world ceiling.
 * @returns `[r, g, b, worldY]` or `undefined` if the column is empty.
 */
function getColumnSurface(chunk: DecodedChunk, x: number, z: number, maxHeight: number): [number, number, number, number] | undefined {
  const minY = chunk.minSectionY * 16
  const maxY = chunk.maxSectionY * 16 + 15

  let worldY = maxY
  if (chunk.heightmapOffset >= 0 && chunk.heightmapBits > 0) {
    const hm = readPacked(chunk.raw, chunk.heightmapOffset, chunk.heightmapLen, chunk.heightmapBits, z * 16 + x)
    if (hm > 0) {
      worldY = Math.min(maxY, minY + hm - 1)
    }
  }
  // Cap the scan at the requested height to peel away layers above it.
  if (worldY > maxHeight) worldY = maxHeight

  while (worldY >= minY) {
    const sectionY = Math.floor(worldY / 16)
    const section = chunk.sections.get(sectionY)
    if (!section) {
      // No data for this whole 16-block slice: jump below it.
      worldY = sectionY * 16 - 1
      continue
    }
    if (section.uniform) {
      if (!section.uniformTransparent) {
        const [r, g, b] = getBlockColor(section.paletteNames[0] ?? 'air')
        return [r, g, b, worldY]
      }
      // Whole section is a transparent block (e.g. air): skip it entirely.
      worldY = sectionY * 16 - 1
      continue
    }
    const localY = worldY - sectionY * 16
    const index = localY * 256 + z * 16 + x
    const paletteIndex = readPacked(chunk.raw, section.dataOffset, section.dataLen, section.bits, index)
    const name = section.paletteNames[paletteIndex] ?? 'air'
    if (name && !isTransparent(name)) {
      const [r, g, b] = getBlockColor(name)
      return [r, g, b, worldY]
    }
    worldY--
  }
  return undefined
}

/**
 * Render a region file into a 512x512 RGBA top-down surface map.
 * @param maxHeight The highest world Y to consider; blocks above are peeled
 * away. Defaults to no cap (the visible surface).
 */
export async function renderSaveRegion(
  savePath: string,
  dimension: string,
  regionX: number,
  regionZ: number,
  maxHeight = Number.POSITIVE_INFINITY,
): Promise<RenderedRegion> {
  const file = join(getRegionDir(savePath, dimension), `r.${regionX}.${regionZ}.mca`)
  const data = new Uint8Array(512 * 512 * 4)
  const chunks: boolean[] = new Array(1024).fill(false)
  const heights = new Int32Array(512 * 512).fill(-2147483648)

  const buffer = await readFile(file).catch(() => undefined)
  if (!buffer || buffer.length < 8192) {
    return { regionX, regionZ, data, chunks }
  }

  for (let localZ = 0; localZ < 32; localZ++) {
    for (let localX = 0; localX < 32; localX++) {
      const headerOffset = 4 * (localX + localZ * 32)
      const sectorOffset = (buffer[headerOffset] << 16) | (buffer[headerOffset + 1] << 8) | buffer[headerOffset + 2]
      if (sectorOffset === 0) continue

      const start = sectorOffset * 4096
      if (start + 5 > buffer.length) continue
      const length = (buffer[start] << 24) | (buffer[start + 1] << 16) | (buffer[start + 2] << 8) | buffer[start + 3]
      const compression = buffer[start + 4]
      if (length <= 0 || start + 5 + length - 1 > buffer.length) continue

      const payload = buffer.subarray(start + 5, start + 4 + length)
      let decoded: DecodedChunk | undefined
      try {
        const raw = compression === 1 ? gunzipSync(payload) : inflateSync(payload)
        decoded = decodeChunk(raw)
      } catch {
        continue
      }

      chunks[localX + localZ * 32] = true
      if (!decoded) continue

      const baseX = localX * 16
      const baseZ = localZ * 16
      for (let cz = 0; cz < 16; cz++) {
        for (let cx = 0; cx < 16; cx++) {
          const surface = getColumnSurface(decoded, cx, cz, maxHeight)
          if (!surface) continue
          const px = baseX + cx
          const pz = baseZ + cz
          const pixel = pz * 512 + px
          const offset = pixel * 4
          data[offset] = surface[0]
          data[offset + 1] = surface[1]
          data[offset + 2] = surface[2]
          data[offset + 3] = 255
          heights[pixel] = surface[3]
        }
      }
    }
  }

  // North-facing relief shading based on height differences.
  for (let pz = 1; pz < 512; pz++) {
    for (let px = 0; px < 512; px++) {
      const pixel = pz * 512 + px
      if (heights[pixel] === -2147483648) continue
      const north = heights[(pz - 1) * 512 + px]
      if (north === -2147483648) continue
      const dy = heights[pixel] - north
      const factor = Math.max(0.65, Math.min(1.35, 1 + dy * 0.05))
      const offset = pixel * 4
      data[offset] = Math.max(0, Math.min(255, Math.round(data[offset] * factor)))
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(data[offset + 1] * factor)))
      data[offset + 2] = Math.max(0, Math.min(255, Math.round(data[offset + 2] * factor)))
    }
  }

  return { regionX, regionZ, data, chunks }
}

/**
 * Delete the given chunks from a dimension by clearing their region-file header
 * entries. Empty region files are removed entirely.
 */
export async function deleteSaveChunks(
  savePath: string,
  dimension: string,
  chunks: Array<{ chunkX: number; chunkZ: number }>,
): Promise<void> {
  const dir = getRegionDir(savePath, dimension)

  // Group chunks by their region file.
  const byRegion = new Map<string, Array<{ chunkX: number; chunkZ: number }>>()
  for (const chunk of chunks) {
    const regionX = chunk.chunkX >> 5
    const regionZ = chunk.chunkZ >> 5
    const key = `${regionX}.${regionZ}`
    const list = byRegion.get(key) ?? []
    list.push(chunk)
    byRegion.set(key, list)
  }

  for (const [key, list] of byRegion) {
    const file = join(dir, `r.${key}.mca`)
    const buffer = await readFile(file).catch(() => undefined)
    if (!buffer || buffer.length < 8192) continue

    for (const { chunkX, chunkZ } of list) {
      const index = (chunkX & 31) + (chunkZ & 31) * 32
      const locOffset = index * 4
      const timeOffset = 4096 + index * 4
      buffer.writeUInt32BE(0, locOffset)
      buffer.writeUInt32BE(0, timeOffset)
    }

    // If no chunk remains in the region, delete the file.
    let hasChunk = false
    for (let i = 0; i < 1024; i++) {
      if (buffer.readUInt32BE(i * 4) !== 0) {
        hasChunk = true
        break
      }
    }

    if (hasChunk) {
      await writeFile(file, buffer)
    } else {
      await unlink(file).catch(() => undefined)
    }
  }
}

/**
 * The raw, still-compressed payload of a single chunk extracted from a region
 * file. This is exactly the bytes a region file stores for a chunk (minus the
 * 4-byte length and 1-byte compression prefix), so it can be written back
 * verbatim into another region file without re-encoding the NBT.
 */
export interface SaveChunkData {
  /** Absolute chunk x coordinate. */
  chunkX: number
  /** Absolute chunk z coordinate. */
  chunkZ: number
  /** Region-file compression type (1 = gzip, 2 = zlib, 3 = uncompressed). */
  compression: number
  /** The compressed chunk payload. */
  data: Uint8Array
}

interface StoredChunk {
  compression: number
  data: Uint8Array
  timestamp: number
}

/**
 * Parse every chunk stored in a region-file buffer into a map keyed by the
 * local chunk index `(x & 31) + (z & 31) * 32`.
 */
function parseRegionChunks(buffer: Buffer): Map<number, StoredChunk> {
  const map = new Map<number, StoredChunk>()
  if (buffer.length < 8192) return map
  for (let index = 0; index < 1024; index++) {
    const headerOffset = index * 4
    const sectorOffset = (buffer[headerOffset] << 16) | (buffer[headerOffset + 1] << 8) | buffer[headerOffset + 2]
    if (sectorOffset === 0) continue
    const start = sectorOffset * 4096
    if (start + 5 > buffer.length) continue
    const length = buffer.readUInt32BE(start)
    if (length <= 0 || start + 4 + length > buffer.length) continue
    const compression = buffer[start + 4]
    const data = Uint8Array.from(buffer.subarray(start + 5, start + 4 + length))
    const timestamp = buffer.readUInt32BE(4096 + headerOffset)
    map.set(index, { compression, data, timestamp })
  }
  return map
}

/**
 * Serialize a set of chunks back into a region-file buffer, laying out the
 * location/timestamp headers and packing each chunk into 4096-byte sectors.
 */
function serializeRegionChunks(entries: Map<number, StoredChunk>): Buffer {
  const locations = Buffer.alloc(4096)
  const timestamps = Buffer.alloc(4096)
  const sectors: Buffer[] = []
  let sectorPointer = 2 // sectors 0 and 1 are the two header tables
  for (const [index, { compression, data, timestamp }] of entries) {
    const recordLength = 5 + data.length
    const sectorCount = Math.ceil(recordLength / 4096)
    // A region-file location entry stores the sector count in a single byte.
    if (sectorCount > 255) continue
    const padded = Buffer.alloc(sectorCount * 4096)
    padded.writeUInt32BE(1 + data.length, 0) // length covers the compression byte + data
    padded.writeUInt8(compression, 4)
    Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(padded, 5)
    sectors.push(padded)
    const headerOffset = index * 4
    locations.writeUInt8((sectorPointer >> 16) & 0xff, headerOffset)
    locations.writeUInt8((sectorPointer >> 8) & 0xff, headerOffset + 1)
    locations.writeUInt8(sectorPointer & 0xff, headerOffset + 2)
    locations.writeUInt8(sectorCount & 0xff, headerOffset + 3)
    timestamps.writeUInt32BE(timestamp >>> 0, headerOffset)
    sectorPointer += sectorCount
  }
  return Buffer.concat([locations, timestamps, ...sectors])
}

function groupChunksByRegion<T extends { chunkX: number; chunkZ: number }>(chunks: T[]): Map<string, T[]> {
  const byRegion = new Map<string, T[]>()
  for (const chunk of chunks) {
    const key = `${chunk.chunkX >> 5}.${chunk.chunkZ >> 5}`
    const list = byRegion.get(key) ?? []
    list.push(chunk)
    byRegion.set(key, list)
  }
  return byRegion
}

/**
 * Read the raw compressed payload of the given chunks so they can be copied
 * into another save. Missing chunks are silently skipped.
 */
export async function readSaveChunks(
  savePath: string,
  dimension: string,
  chunks: Array<{ chunkX: number; chunkZ: number }>,
): Promise<SaveChunkData[]> {
  const dir = getRegionDir(savePath, dimension)
  const result: SaveChunkData[] = []
  for (const [key, list] of groupChunksByRegion(chunks)) {
    const file = join(dir, `r.${key}.mca`)
    const buffer = await readFile(file).catch(() => undefined)
    if (!buffer || buffer.length < 8192) continue
    for (const { chunkX, chunkZ } of list) {
      const index = (chunkX & 31) + (chunkZ & 31) * 32
      const headerOffset = index * 4
      const sectorOffset = (buffer[headerOffset] << 16) | (buffer[headerOffset + 1] << 8) | buffer[headerOffset + 2]
      if (sectorOffset === 0) continue
      const start = sectorOffset * 4096
      if (start + 5 > buffer.length) continue
      const length = buffer.readUInt32BE(start)
      if (length <= 0 || start + 4 + length > buffer.length) continue
      const compression = buffer[start + 4]
      const data = Uint8Array.from(buffer.subarray(start + 5, start + 4 + length))
      result.push({ chunkX, chunkZ, compression, data })
    }
  }
  return result
}

/**
 * Write the given chunks into a dimension, overwriting any chunk that already
 * exists at the same coordinates. Region files are created when needed.
 */
export async function writeSaveChunks(
  savePath: string,
  dimension: string,
  chunks: SaveChunkData[],
): Promise<void> {
  if (chunks.length === 0) return
  const dir = getRegionDir(savePath, dimension)
  await ensureDir(dir)
  const now = Math.floor(Date.now() / 1000)
  for (const [key, list] of groupChunksByRegion(chunks)) {
    const file = join(dir, `r.${key}.mca`)
    const buffer = await readFile(file).catch(() => undefined)
    const entries = buffer ? parseRegionChunks(buffer) : new Map<number, StoredChunk>()
    for (const { chunkX, chunkZ, compression, data } of list) {
      const index = (chunkX & 31) + (chunkZ & 31) * 32
      entries.set(index, { compression, data, timestamp: now })
    }
    await writeFile(file, serializeRegionChunks(entries))
  }
}

/**
 * Overwrite the `xPos`/`zPos` integer tags of a chunk root compound (and the
 * legacy `Level.xPos`/`Level.zPos`) in place, so a relocated chunk reports the
 * coordinates of its new home. Without this Minecraft detects a mismatch
 * between the region-file slot and the stored position and regenerates it.
 */
function patchChunkPositionInCompound(r: ChunkNbtReader, chunkX: number, chunkZ: number): void {
  for (;;) {
    const t = r.u8()
    if (t === TAG_END) break
    const key = r.str()
    if (t === TAG_INT && key === 'xPos') {
      r.buf.writeInt32BE(chunkX | 0, r.pos)
      r.pos += 4
    } else if (t === TAG_INT && key === 'zPos') {
      r.buf.writeInt32BE(chunkZ | 0, r.pos)
      r.pos += 4
    } else if (t === TAG_COMPOUND && key === 'Level') {
      // Pre-1.18 worlds nest xPos/zPos inside a `Level` compound.
      patchChunkPositionInCompound(r, chunkX, chunkZ)
    } else {
      r.skip(t)
    }
  }
}

function patchChunkPosition(raw: Buffer, chunkX: number, chunkZ: number): void {
  const r = new ChunkNbtReader(raw)
  if (r.u8() !== TAG_COMPOUND) return
  r.skipStr() // root compound name
  patchChunkPositionInCompound(r, chunkX, chunkZ)
}

/**
 * Return a copy of `chunks` moved by `(offsetX, offsetZ)` chunks. Each chunk's
 * NBT position is rewritten to match its new coordinates so the game loads it
 * at the chosen location.
 *
 * Block entities keep their original absolute coordinates, so tile entities
 * (chests, signs, etc.) in relocated chunks may be dropped by the game — the
 * terrain itself relocates correctly.
 */
export function relocateSaveChunks(chunks: SaveChunkData[], offsetX: number, offsetZ: number): SaveChunkData[] {
  if (offsetX === 0 && offsetZ === 0) return chunks
  return chunks.map((c) => {
    const chunkX = c.chunkX + offsetX
    const chunkZ = c.chunkZ + offsetZ
    let raw: Buffer
    try {
      if (c.compression === 1) raw = gunzipSync(c.data)
      else if (c.compression === 2) raw = inflateSync(c.data)
      else raw = Buffer.from(c.data)
    } catch {
      // Undecodable payload: relocate the region slot without touching the NBT.
      return { chunkX, chunkZ, compression: c.compression, data: c.data }
    }
    patchChunkPosition(raw, chunkX, chunkZ)
    let data: Uint8Array
    if (c.compression === 1) data = gzipSync(raw)
    else if (c.compression === 2) data = deflateSync(raw)
    else data = raw
    return { chunkX, chunkZ, compression: c.compression, data }
  })
}
