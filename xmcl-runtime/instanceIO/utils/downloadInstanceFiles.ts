import { DownloadBaseOptions, DownloadMultipleOption, downloadMultiple } from '@xmcl/file-transfer'
import { Tracker, onDownloadMultiple } from '@xmcl/installer'
import { InstanceFile } from '@xmcl/instance'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'

const MAX_RETRY_COUNT = 3

function toDownloadOptions(opt: { options: DownloadMultipleOption; file: InstanceFile }) {
  return {
    url: opt.options.url,
    destination: opt.options.destination,
    headers: opt.options.headers,
    pendingFile: opt.options.pendingFile,
    validator: (opt.options as any).validator,
    expectedTotal: (
      typeof opt.options.url === 'string'
        ? opt.options.url.includes('edge.forgecdn.net')
        : opt.options.url.some((u) => u.includes('edge.forgecdn.net'))
    )
      ? undefined
      : opt.options.expectedTotal,
  }
}

/**
 * Download instance files with progress tracking.
 * Failed downloads are retried up to {@link MAX_RETRY_COUNT} times.
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
    options: options.map(toDownloadOptions),
    signal: signal,
    tracker: parent,
    ...downloadOptions,
  })

  // Mark finished files and collect initial failures
  let pending: Array<{ options: DownloadMultipleOption; file: InstanceFile }> = []
  let errors: Error[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      finished.add(options[i].file.path)
    } else {
      pending.push(options[i])
      errors.push(result.reason)
    }
  }

  // Retry failed downloads
  for (let retryAttempt = 0; retryAttempt < MAX_RETRY_COUNT && pending.length > 0; retryAttempt++) {
    signal.throwIfAborted()

    const retryResults = await downloadMultiple({
      options: pending.map(toDownloadOptions),
      signal: signal,
      tracker: parent,
      ...downloadOptions,
    })

    const nextPending: typeof pending = []
    const nextErrors: Error[] = []
    for (let i = 0; i < retryResults.length; i++) {
      const result = retryResults[i]
      if (result.status === 'fulfilled') {
        finished.add(pending[i].file.path)
      } else {
        nextPending.push(pending[i])
        nextErrors.push(result.reason)
      }
    }
    pending = nextPending
    errors = nextErrors
  }

  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}

