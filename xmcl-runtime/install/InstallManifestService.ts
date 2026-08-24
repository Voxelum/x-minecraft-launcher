import {
  createNodeInstallRuntime,
  executeInstallManifest,
  type InstallFile,
  type InstallManifest,
  type ProgressTrackerMultiple,
} from '@xmcl/installer'
import { spawn } from 'child_process'
import { Inject, LauncherApp, LauncherAppKey, type InjectionKey } from '~/app'
import { kResourceWorker, ResourceWorker } from '~/resource'
import { AbstractService } from '~/service'
import { waitProcess } from '@xmcl/installer/utils'

export interface InstallFileDownloadContext {
  signal?: AbortSignal
  tracker?: ProgressTrackerMultiple
}

export interface InstallFileDownloader {
  download(files: InstallFile[], context?: InstallFileDownloadContext): Promise<void>
}

export const kInstallFileDownloader: InjectionKey<InstallFileDownloader> = Symbol('InstallFileDownloader')

export class InstallManifestService extends AbstractService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kInstallFileDownloader) private downloader: InstallFileDownloader,
    @Inject(kResourceWorker) private resourceWorker: ResourceWorker,
  ) {
    super(app)
  }

  install(plan: InstallManifest, context: {
    signal?: AbortSignal
    tracker?: ProgressTrackerMultiple
  } = {}) {
    return executeInstallManifest(
      plan,
      createNodeInstallRuntime({
        signal: context.signal,
        download: (files) => this.downloader.download(files, context),
        checksum: (path, algorithm) => this.resourceWorker.checksum(path, algorithm),
        runJava: async (command) => {
          const child = spawn(command.executable, command.args, {
            cwd: command.cwd,
            env: command.env ? { ...process.env, ...command.env } : undefined,
            signal: context.signal,
          })
          await waitProcess(child)
        },
      }),
      {
        signal: context.signal,
        onEvent: (event) => {
          if (event.type === 'file-retry') {
            this.warn(`Retry install task ${event.task.id} attempt ${event.attempt + 1} in ${event.delay}ms (${event.pending} file(s) pending)`)
          }
          this.app.emit('install-manifest', event)
        },
      },
    )
  }
}
