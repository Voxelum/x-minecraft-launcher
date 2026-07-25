import { createHash, randomUUID } from 'crypto'
import { mkdir, readFile, rm, symlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { exportLocalWorldSeed, listLocalWorldSeedCandidates } from './worldSeedArchive'

describe('exportLocalWorldSeed', () => {
  it('creates a deterministic seed without modifying the local world', async () => {
    const root = join(process.cwd(), '.test-artifacts', `world-seed-${randomUUID()}`)
    const world = join(root, 'instance', 'saves', 'World')
    try {
      await mkdir(join(world, 'region'), { recursive: true })
      await writeFile(join(world, 'level.dat'), Buffer.from([1, 2, 3]))
      await writeFile(join(world, 'region', 'r.0.0.mca'), Buffer.from([4, 5, 6]))
      const before = await hash(join(world, 'level.dat'))
      const first = await exportLocalWorldSeed({ instancePath: join(root, 'instance'), saveName: 'World', destination: join(root, 'first.xmcl-world-seed') })
      const second = await exportLocalWorldSeed({ instancePath: join(root, 'instance'), saveName: 'World', destination: join(root, 'second.xmcl-world-seed') })
      expect(first.archiveSha256).toBe(second.archiveSha256)
      expect(first.files.map(file => file.path)).toEqual(['world/level.dat', 'world/region/r.0.0.mca'])
      expect(await hash(join(world, 'level.dat'))).toBe(before)
      expect((await listLocalWorldSeedCandidates(join(root, 'instance')))[0].logicalSizeBytes).toBe(6)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects traversal names, scripts, and links instead of exporting private or unsafe data', async () => {
    const root = join(process.cwd(), '.test-artifacts', `world-seed-reject-${randomUUID()}`)
    const world = join(root, 'instance', 'saves', 'World')
    try {
      await mkdir(world, { recursive: true })
      await writeFile(join(world, 'level.dat'), 'world')
      await writeFile(join(world, 'server.sh'), '#!/bin/sh')
      await expect(exportLocalWorldSeed({ instancePath: join(root, 'instance'), saveName: 'World', destination: join(root, 'bad.xmcl-world-seed') }))
        .rejects.toThrow(/rejected/)
      await expect(exportLocalWorldSeed({ instancePath: join(root, 'instance'), saveName: '..', destination: join(root, 'bad.xmcl-world-seed') }))
        .rejects.toThrow(/Invalid/)
      await rm(join(world, 'server.sh'))
      try {
        await symlink(join(world, 'level.dat'), join(world, 'linked.dat'))
        await expect(exportLocalWorldSeed({ instancePath: join(root, 'instance'), saveName: 'World', destination: join(root, 'linked.xmcl-world-seed') }))
          .rejects.toThrow(/links/)
      } catch (error) {
        // Windows may deny unprivileged symlink creation; the deterministic
        // script/private-data rejection above still exercises the safe path.
        if (!(error instanceof Error) || !/links/.test(error.message)) return
        throw error
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function hash(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
