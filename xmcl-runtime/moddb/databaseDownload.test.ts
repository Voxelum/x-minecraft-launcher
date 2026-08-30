import { describe, expect, it, vi } from 'vitest'
import {
  createDatabaseDownloadController,
  databaseAssetExists,
  fetchDatabaseText,
  getModMetadataDownloadUrls,
  getProjectMappingDownloadUrls,
} from './databaseDownload'

describe('database downloads', () => {
  it('uses GitHub releases before the XMCL streaming proxy', () => {
    expect(getModMetadataDownloadUrls('db.sqlite')).toEqual([
      'https://github.com/Voxelum/minecraft-mods-database/releases/latest/download/db.sqlite',
      'https://api.xmcl.app/downloads/databases/mod-metadata/db.sqlite',
    ])
    expect(getProjectMappingDownloadUrls('zh-cn.sqlite.gz')).toEqual([
      'https://github.com/Voxelum/xmcl-commuity-content-i18n/releases/latest/download/zh-cn.sqlite.gz',
      'https://api.xmcl.app/downloads/databases/project-mapping/zh-cn.sqlite.gz',
    ])
  })

  it('falls back when GitHub metadata cannot be fetched', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('GitHub unavailable'))
      .mockResolvedValueOnce(new Response(' checksum\n'))

    await expect(
      fetchDatabaseText(fetcher, ['https://github.com/db', 'https://api.xmcl.app/db']),
    ).resolves.toBe('checksum')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('treats a GitHub 404 as a missing locale without proxying it again', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))

    await expect(
      databaseAssetExists(fetcher, ['https://github.com/missing', 'https://api.xmcl.app/missing']),
    ).resolves.toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('moves slow or stalled GitHub payloads to the fallback only', () => {
    const controller = createDatabaseDownloadController()
    expect(controller.isAbortable?.('https://github.com')).toBe(true)
    expect(controller.isAbortable?.('https://api.xmcl.app')).toBe(false)
    expect(
      controller.onSample?.({
        origin: 'https://github.com',
        received: 64 * 1024,
        total: 1024 * 1024,
        speed: 64 * 1024,
        elapsed: 6_000,
      }),
    ).toBe('abort')
    expect(
      controller.onSample?.({
        origin: 'https://api.xmcl.app',
        received: 64 * 1024,
        total: 1024 * 1024,
        speed: 64 * 1024,
        elapsed: 6_000,
      }),
    ).toBe('continue')
  })
})
