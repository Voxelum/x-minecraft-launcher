import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  exportLocalServerBundle,
  preflightLocalServerBundle,
  ServerBundleError,
} from './server_bundle'

function storedZip(entries: Array<{ path: string; bytes: Buffer }>) {
  const output: number[] = []
  const central: number[] = []
  for (const entry of entries) {
    const name = Buffer.from(entry.path)
    const crc = crc32(entry.bytes)
    const offset = output.length
    write32(output, 0x04034b50); write16(output, 20); write16(output, 0x800); write16(output, 0)
    write16(output, 0); write16(output, 0); write32(output, crc); write32(output, entry.bytes.length)
    write32(output, entry.bytes.length); write16(output, name.length); write16(output, 0)
    output.push(...name, ...entry.bytes)
    write32(central, 0x02014b50); write16(central, 20); write16(central, 20); write16(central, 0x800)
    write16(central, 0); write16(central, 0); write16(central, 0); write32(central, crc)
    write32(central, entry.bytes.length); write32(central, entry.bytes.length); write16(central, name.length)
    write16(central, 0); write16(central, 0); write16(central, 0); write16(central, 0); write32(central, 0)
    write32(central, offset); central.push(...name)
  }
  const offset = output.length
  output.push(...central)
  write32(output, 0x06054b50); write16(output, 0); write16(output, 0); write16(output, entries.length)
  write16(output, entries.length); write32(output, central.length); write32(output, offset); write16(output, 0)
  return Buffer.from(output)
}

function write16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function write32(target: number[], value: number) {
  write16(target, value & 0xffff)
  write16(target, value >>> 16)
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

describe('server_bundle', () => {
  it('exports deterministic server-only bundles after acknowledged compatibility warnings', async () => {
    const root = join(process.cwd(), '.test-artifacts', `server-bundle-${randomUUID()}`)
    const instance = join(root, 'instances', 'pack')
    try {
      await mkdir(join(instance, 'mods'), { recursive: true })
      await mkdir(join(instance, 'config'), { recursive: true })
      await mkdir(join(instance, 'kubejs'), { recursive: true })
      await mkdir(join(instance, 'scripts'), { recursive: true })
      await writeFile(join(instance, 'mods', 'client-only.jar'), storedZip([
        { path: 'fabric.mod.json', bytes: Buffer.from('{"environment":"client"}') },
      ]))
      await writeFile(join(instance, 'config', 'server.cfg'), 'dedicated=true')
      await writeFile(join(instance, 'kubejs', 'server_scripts.js'), 'ServerEvents.recipes(() => {})')
      await writeFile(join(instance, 'scripts', 'server.zs'), 'print("server")')
      await writeFile(join(instance, 'logs.txt'), 'private client log')
      await writeFile(join(instance, 'server.sh'), '#!/bin/sh\nbad')
      await writeFile(join(instance, 'eula.txt'), 'eula=true\n')
      const input = {
        instancePath: instance,
        metadata: {
          instanceName: 'Test pack',
          minecraftVersion: '1.21.1',
          loader: { kind: 'fabric' as const, version: '0.16.10' },
          javaRequirement: { component: 'java-runtime-delta', major: 21 },
          runtimeCatalog: {
            sha256: 'a'.repeat(64),
            requirements: [{ component: 'java-runtime-delta', major: 21 }],
          },
        },
      }
      const preflight = await preflightLocalServerBundle(input)
      expect(preflight.compatible).toBe(true)
      expect(preflight.warnings.some((warning) => warning.code === 'client_only_mod')).toBe(true)
      expect(preflight.excluded.some((file) => file.path === 'server.sh')).toBe(true)
      expect(preflight.excluded.some((file) => file.path === 'eula.txt')).toBe(true)

      await expect(exportLocalServerBundle({
        ...input,
        outputPath: join(root, 'first'),
      })).rejects.toMatchObject({ code: 'warnings_not_acknowledged' } satisfies Partial<ServerBundleError>)

      const first = await exportLocalServerBundle({
        ...input,
        outputPath: join(root, 'first'),
        acknowledgeWarnings: true,
      })
      const second = await exportLocalServerBundle({
        ...input,
        outputPath: join(root, 'second'),
        acknowledgeWarnings: true,
      })
      expect(first.archiveSha256).toBe(second.archiveSha256)
      expect(first.manifest.files.map((file) => file.path)).toEqual([
        ...first.manifest.files.map((file) => file.path),
      ].sort())
      expect(first.manifest.files.some((file) => file.path.endsWith('server.sh'))).toBe(false)
      expect(first.manifest.files.some((file) => file.path.endsWith('eula.txt'))).toBe(false)
      expect(first.manifest.files.some((file) => file.path === 'resolved/artifacts.json')).toBe(true)
      expect(first.manifest.files.some((file) => file.path.startsWith('resolved/libraries/'))).toBe(false)
      const archive = await readFile(first.outputPath)
      expect(archive.toString()).toContain('"intent":"kubejs"')
      expect(archive.toString()).toContain('"intent":"script"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
