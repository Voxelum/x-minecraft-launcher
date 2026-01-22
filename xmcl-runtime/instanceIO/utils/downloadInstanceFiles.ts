import { DownloadBaseOptions, DownloadMultipleOption, downloadMultiple } from '@xmcl/file-transfer'
import { Tracker, onDownloadMultiple } from '@xmcl/installer'
import { InstanceFile } from '@xmcl/instance'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'

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
      pendingFile: opt.options.pendingFile,
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
  })

  // Mark finished files and collect errors
  const errors: Error[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      finished.add(options[i].file.path)
    } else {
      errors.push(result.reason)
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}
