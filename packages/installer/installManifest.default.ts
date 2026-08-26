import {
  downloadMultiple,
  ConcurrencyDispatcher,
  getDownloadBaseOptions,
  type DownloadBaseOptions,
  type ProgressTrackerMultiple as FileTransferProgressTrackerMultiple,
} from '@xmcl/file-transfer'
import {
  createNodeInstallRuntime,
  type InstallFile,
  type InstallRuntime,
  type NodeInstallRuntimeOptions,
} from './installManifest'
import type { ProgressTrackerMultiple } from './tracker'

export interface DefaultNodeInstallRuntimeOptions
  extends NodeInstallRuntimeOptions, DownloadBaseOptions {
  tracker?: ProgressTrackerMultiple
  maxConcurrency?: number
}

export function createFileTransferInstallDownload(
  options: DefaultNodeInstallRuntimeOptions = {},
): (files: InstallFile[]) => Promise<void> {
  const base = getDownloadBaseOptions(options)
  const dispatcher = new ConcurrencyDispatcher(base.dispatcher, () => options.maxConcurrency ?? 32)
  return async (files) => {
    const results = await downloadMultiple({
      options: files.map((file) => ({
        url: file.urls,
        destination: file.path,
        expectedTotal: file.size,
      })),
      signal: options.signal,
      tracker: options.tracker as FileTransferProgressTrackerMultiple | undefined,
      ...base,
      dispatcher,
    })
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failures.length > 0) throw new AggregateError(failures.map((failure) => failure.reason))
  }
}

export function createDefaultNodeInstallRuntime(
  options: DefaultNodeInstallRuntimeOptions = {},
): InstallRuntime {
  return createNodeInstallRuntime({
    ...options,
    download: options.download ?? createFileTransferInstallDownload(options),
  })
}
