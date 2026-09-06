import { DownloadBaseOptions, DownloadMultipleOption, downloadMultiple } from '@xmcl/file-transfer'
import { Tracker, onDownloadMultiple } from '@xmcl/installer'
import { InstanceFile } from '@xmcl/instance'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { verifyInstanceFile } from './verifyInstanceFile'

/**
 * Download instance files with progress tracking.
 */
export async function downloadInstanceFiles(
  options: Array<{ options: DownloadMultipleOption; file: InstanceFile }>,
  finished: Set<string>,
  signal: AbortSignal,
  downloadOptions: DownloadBaseOptions,
  tracker?: Tracker<InstallInstanceTrackerEvents>,
): Promise<void> {
  const parent = onDownloadMultiple(tracker, 'install-instance.download', { count: options.length })

  const results = await downloadMultiple({
    options: options.map((opt) => ({
      url: opt.options.url,
      destination: opt.options.destination,
      headers: opt.options.headers,
      expectedTotal: (
        typeof opt.options.url === 'string'
          ? opt.options.url.includes('edge.forgecdn.net')
          : opt.options.url.some((u) => u.includes('edge.forgecdn.net'))
      )
        ? undefined
        : opt.options.expectedTotal,
    })),
    signal: signal,
    tracker: parent,
    ...downloadOptions,
    onFileComplete: async (index) => {
      const { file, options: opts } = options[index]
      try {
        await verifyInstanceFile(file, opts.destination)
        finished.add(file.path)
      } catch (error) {
        await unlink(opts.destination).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') throw new AggregateError([error, cleanupError])
        })
        throw error
      }
    },
  })

  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}
