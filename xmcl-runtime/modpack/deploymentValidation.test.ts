import type { Entry } from '@xmcl/yauzl'
import { describe, expect, it } from 'vitest'
import { validateModpackDeploymentArchive } from './deploymentValidation'

function entry(
  fileName: string,
  uncompressedSize = 10,
  compressedSize = 10,
  attributes: Partial<Entry> = {},
): Entry {
  return {
    fileName,
    uncompressedSize,
    compressedSize,
    externalFileAttributes: 0,
    versionMadeBy: 0,
    ...attributes,
  } as Entry
}

function resolveOverrides(zipEntry: Entry): string | undefined {
  return zipEntry.fileName.startsWith('overrides/')
    ? zipEntry.fileName.slice('overrides/'.length)
    : undefined
}

describe('validateModpackDeploymentArchive', () => {
  it('classifies allowlisted payloads and normalized provider sources', () => {
    const report = validateModpackDeploymentArchive({
      importId: 'import-1',
      sourceFormat: 'mrpack',
      entries: [
        entry('modrinth.index.json'),
        entry('overrides/config/server.toml'),
        entry('overrides/data/example/tags/functions/tick.json'),
      ],
      sources: [{
        path: 'mods/example.jar',
        filename: 'example.jar',
        provider: 'modrinth',
        projectId: 'example-project',
        fileId: 'version_1',
      }],
      resolvePayloadPath: resolveOverrides,
    })

    expect(report).toEqual({
      importId: 'import-1',
      sourceFormat: 'mrpack',
      status: 'valid',
      configFiles: ['config/server.toml'],
      dataFiles: ['data/example/tags/functions/tick.json'],
      mods: [{
        provider: 'modrinth',
        projectId: 'example-project',
        fileId: 'version_1',
        filename: 'example.jar',
      }],
      rejectedFiles: [],
    })
  })

  it.each([
    ['../outside.txt', 'path traversal'],
    ['/absolute.txt', 'absolute path'],
    ['C:/absolute.txt', 'absolute path'],
    ['overrides/mods/embedded.jar', 'embedded executable or script'],
    ['overrides/options.txt', 'payload is outside config and data allowlist'],
    ['unexpected.txt', 'file is outside manifest, config, and data allowlist'],
  ])('rejects unsafe entry %s', (fileName, reason) => {
    const report = validateModpackDeploymentArchive({
      importId: 'import-unsafe',
      sourceFormat: 'curseforge_zip',
      entries: [entry('manifest.json'), entry(fileName)],
      sources: [],
      resolvePayloadPath: resolveOverrides,
    })

    expect(report.status).toBe('invalid')
    expect(report.rejectedFiles).toContainEqual({ path: fileName, reason })
  })

  it('rejects case-insensitive duplicate paths and Unix symbolic links', () => {
    const symbolicLinkMode = 0o120777 << 16
    const report = validateModpackDeploymentArchive({
      importId: 'import-entries',
      sourceFormat: 'mrpack',
      entries: [
        entry('modrinth.index.json'),
        entry('overrides/config/a.toml'),
        entry('OVERRIDES/CONFIG/A.TOML'),
        entry('overrides/data/link', 4, 4, {
          versionMadeBy: 3 << 8,
          externalFileAttributes: symbolicLinkMode,
        }),
      ],
      sources: [],
      resolvePayloadPath: resolveOverrides,
    })

    expect(report.status).toBe('invalid')
    expect(report.rejectedFiles).toContainEqual({
      path: 'OVERRIDES/CONFIG/A.TOML',
      reason: 'duplicate path',
    })
    expect(report.rejectedFiles).toContainEqual({
      path: 'overrides/data/link',
      reason: 'symbolic link',
    })
  })

  it('rejects archive limits and a missing manifest', () => {
    const report = validateModpackDeploymentArchive({
      importId: 'import-limits',
      sourceFormat: 'mrpack',
      entries: [entry('overrides/config/large.txt', 101, 1)],
      sources: [],
      resolvePayloadPath: resolveOverrides,
      limits: {
        maxEntries: 0,
        maxUncompressedBytes: 100,
        maxCompressionRatio: 100,
      },
    })

    expect(report.status).toBe('invalid')
    expect(report.rejectedFiles.map(rejection => rejection.path)).toEqual([
      '<archive>',
      'overrides/config/large.txt',
      'modrinth.index.json',
      '<archive>',
    ])
  })

  it('invalidates the entire report when a mod source is unresolved', () => {
    const report = validateModpackDeploymentArchive({
      importId: 'import-source',
      sourceFormat: 'curseforge_zip',
      entries: [entry('manifest.json')],
      sources: [{ path: 'mods/unknown.jar', filename: 'unknown.jar' }],
      resolvePayloadPath: resolveOverrides,
    })

    expect(report.status).toBe('invalid')
    expect(report.mods).toEqual([])
    expect(report.rejectedFiles).toEqual([{
      path: 'mods/unknown.jar',
      reason: 'unresolved or invalid provider source',
    }])
  })
})