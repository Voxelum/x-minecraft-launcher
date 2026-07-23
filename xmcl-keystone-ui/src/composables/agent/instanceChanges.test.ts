import type { InstanceFile } from '@xmcl/instance'
import { describe, expect, test, vi } from 'vitest'
import { createInstanceChangeOperations } from './instanceChanges'

function file(path: string, sha1 = path): InstanceFile {
  return { path, hashes: { sha1 }, size: 1 }
}

function setup() {
  let path: string | undefined = '/instance'
  const previewInstanceFiles = vi.fn(async ({ oldFiles, files }) => [
    ...oldFiles.map((entry: InstanceFile) => ({ file: entry, operation: 'remove' as const })),
    ...files.map((entry: InstanceFile) => ({ file: entry, operation: 'add' as const })),
  ])
  const installInstanceFiles = vi.fn(async () => {})
  const operations = createInstanceChangeOperations({
    currentInstancePath: () => path,
    instanceInstall: { previewInstanceFiles, installInstanceFiles },
  })
  return { operations, previewInstanceFiles, installInstanceFiles, select: (value: string | undefined) => { path = value } }
}

describe('instance change transaction', () => {
  test('adds changes directly and applies the accumulated list once', async () => {
    const { operations, installInstanceFiles } = setup()
    await operations.add({ label: 'dependency', oldFiles: [], files: [file('mods/a.jar')] })
    await operations.add({ label: 'resource pack', oldFiles: [], files: [file('resourcepacks/b.zip')] })
    expect(await operations.apply()).toMatchObject({ applied: true, labels: ['dependency', 'resource pack'] })

    expect(installInstanceFiles).toHaveBeenCalledTimes(1)
    expect(installInstanceFiles).toHaveBeenCalledWith(expect.objectContaining({
      path: '/instance',
      oldFiles: [],
      files: [file('mods/a.jar'), file('resourcepacks/b.zip')],
    }))
    expect(await operations.status()).toMatchObject({ changes: { labels: [], remove: [], add: [] } })
  })

  test('keeps the original file and latest replacement across successive changes', async () => {
    const { operations, installInstanceFiles } = setup()
    await operations.add({ label: 'v2', oldFiles: [file('mods/a.jar', 'v1')], files: [file('mods/a.jar', 'v2')] })
    await operations.add({ label: 'v3', oldFiles: [file('mods/a.jar', 'v2')], files: [file('mods/a.jar', 'v3')] })
    await operations.apply()

    expect(installInstanceFiles).toHaveBeenCalledWith(expect.objectContaining({
      oldFiles: [file('mods/a.jar', 'v1')],
      files: [file('mods/a.jar', 'v3')],
    }))
  })

  test('cancels a file added and then removed within the transaction', async () => {
    const { operations } = setup()
    const added = file('mods/a.jar')
    await operations.add({ label: 'add', oldFiles: [], files: [added] })
    await operations.add({ label: 'remove', oldFiles: [added], files: [] })

    const status = await operations.status()
    expect(status).toMatchObject({ changes: { remove: [], add: [] } })
    expect(await operations.apply()).toMatchObject({ applied: false })
  })

  test('reset and instance selection changes discard all pending state', async () => {
    const { operations, select } = setup()
    await operations.add({ label: 'add', oldFiles: [], files: [file('mods/a.jar')] })
    expect(await operations.reset()).toEqual({ reset: true })
    expect(await operations.status()).toMatchObject({ changes: { labels: [], add: [] } })

    await operations.add({ label: 'add', oldFiles: [], files: [file('mods/b.jar')] })
    select('/other')
    expect(await operations.status()).toMatchObject({ instancePath: '/other', changes: { labels: [], add: [] } })
  })
})
