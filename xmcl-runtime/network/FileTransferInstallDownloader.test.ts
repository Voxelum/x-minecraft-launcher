import { downloadMultiple, type DownloadController } from '@xmcl/file-transfer'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createFileTransferInstallDownloader } from './FileTransferInstallDownloader'

vi.mock('@xmcl/file-transfer', async (importOriginal) => ({
  ...await importOriginal<typeof import('@xmcl/file-transfer')>(),
  downloadMultiple: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('FileTransferInstallDownloader', () => {
  test('translates manifest files and enables the adaptive controller for BMCL batches', async () => {
    const controller = {} as DownloadController
    vi.mocked(downloadMultiple).mockResolvedValue([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ])
    const downloader = createFileTransferInstallDownloader({}, controller)

    await downloader.download([
      { path: 'bmcl', urls: ['https://bmclapi2.bangbang93.com/file'], size: 1 },
      { path: 'official', urls: ['https://example.com/file'], size: 1 },
    ])

    expect(downloadMultiple).toHaveBeenCalledWith(expect.objectContaining({
      options: [
        {
          url: ['https://bmclapi2.bangbang93.com/file'],
          destination: 'bmcl',
          expectedTotal: 1,
          controller,
        },
        {
          url: ['https://example.com/file'],
          destination: 'official',
          expectedTotal: 1,
          controller: undefined,
        },
      ],
    }))
  })

  test('attributes a download failure to its manifest file', async () => {
    const reset = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    vi.mocked(downloadMultiple).mockResolvedValue([
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: reset },
    ])
    const downloader = createFileTransferInstallDownloader({})

    const result = downloader.download([
      { path: 'client.jar', urls: ['https://example.com/client.jar'] },
      { path: 'neoforge-installer.jar', urls: ['https://maven.neoforged.net/installer.jar'] },
    ])

    await expect(result).rejects.toMatchObject({
      errors: [expect.objectContaining({
        name: 'InstallFileDownloadError',
        message: 'Failed to download neoforge-installer.jar: read ECONNRESET',
        code: 'ECONNRESET',
        path: 'neoforge-installer.jar',
      })],
    })
  })
})
