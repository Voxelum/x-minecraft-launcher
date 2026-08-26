import {
  downloadMultiple,
  type DownloadBaseOptions,
  type DownloadController,
} from '@xmcl/file-transfer'
import type { InstallFileDownloader } from '~/install/InstallManifestService'

export function createFileTransferInstallDownloader(
  options: DownloadBaseOptions,
  adaptiveController?: DownloadController,
): InstallFileDownloader {
  return {
    async download(files, context = {}) {
      const results = await downloadMultiple({
        options: files.map((file) => ({
          url: file.urls,
          destination: file.path,
          expectedTotal: file.size,
          controller: file.urls.some((url) => {
            try {
              return new URL(url).hostname === 'bmclapi2.bangbang93.com'
            } catch {
              return false
            }
          }) ? adaptiveController : undefined,
        })),
        ...options,
        signal: context.signal,
        tracker: context.tracker,
      })
      const failures = results.flatMap((result, index) => {
        if (result.status !== 'rejected') return []
        const file = files[index]
        const reason = result.reason
        const message = reason instanceof Error ? reason.message : String(reason)
        const error = new Error(`Failed to download ${file.path}: ${message}`, {
          cause: reason,
        })
        error.name = 'InstallFileDownloadError'
        Object.assign(error, {
          path: file.path,
          urls: file.urls,
          code: reason && typeof reason === 'object' && 'code' in reason ? reason.code : undefined,
        })
        return [error]
      })
      if (failures.length > 0) throw new AggregateError(failures)
    },
  }
}
