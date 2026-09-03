import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { remove } from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleMigrateRoot, takeCompletedMigrationTelemetry } from './migrate'

describe('data-root migration telemetry', () => {
  const originalArgv = [...process.argv]
  const roots: string[] = []

  afterEach(async () => {
    process.argv = [...originalArgv]
    takeCompletedMigrationTelemetry()
    await Promise.all(roots.splice(0).map((root) => remove(root)))
  })

  it('records completed migration work with its incoming trace context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-migrate-test-'))
    roots.push(root)
    const source = join(root, 'source')
    const destination = join(root, 'destination')
    const appDataPath = join(root, 'app-data')
    await Promise.all([
      mkdir(source, { recursive: true }),
      mkdir(destination, { recursive: true }),
      mkdir(appDataPath, { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(source, 'options.txt'), 'fov:90'),
      writeFile(join(appDataPath, '.keep'), ''),
    ])
    const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    process.argv = [
      ...originalArgv,
      '--migrate',
      destination,
      '--migration-traceparent',
      traceparent,
    ]
    const app = {
      appDataPath,
      controller: {
        startMigrate: vi.fn(),
        handle: vi.fn(),
        broadcast: vi.fn(),
        endMigrate: vi.fn(),
      },
    }
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
    }

    await expect(handleMigrateRoot(source, logger, app)).resolves.toBe(destination)
    await expect(readFile(join(destination, 'options.txt'), 'utf8')).resolves.toBe('fov:90')
    expect(takeCompletedMigrationTelemetry()).toMatchObject({
      traceparent,
      outcome: 'success',
      copiedFiles: 1,
    })
    expect(takeCompletedMigrationTelemetry()).toBeUndefined()
  })
})
