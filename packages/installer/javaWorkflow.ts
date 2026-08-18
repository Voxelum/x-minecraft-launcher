import { basename, dirname, join } from 'path'
import { readFile } from 'fs/promises'
import type {
  JavaRuntimeManifest,
  JavaRuntimeTarget,
} from './java-runtime.browser'
import type {
  InstallFile,
  InstallMaterializeOperation,
  InstallOutput,
  InstallWorkflow,
  InstallTask,
} from './installManifest'
import type { ZuluJRE } from './zulu'
import type { WithDownload } from './tracker'

export interface JavaRuntimeTrackerEvents {
  'java-runtime.json': WithDownload<{ target: string }>
  'java-runtime.file': WithDownload<{ path: string }>
}

function normalizeUrls(url: string, hosts?: string | string[]) {
  if (!hosts) return [url]
  const values = typeof hosts === 'string' ? [hosts] : hosts
  const urls = values.map((host) => {
    const result = new URL(url)
    result.hostname = host
    return result.toString()
  })
  if (!urls.includes(url)) urls.push(url)
  return urls
}

export interface JavaRuntimeInstallWorkflowOptions {
  target: JavaRuntimeTarget
  destination: string
  apiHost?: string | string[]
}

export function createJavaRuntimeInstallWorkflow(
  options: JavaRuntimeInstallWorkflowOptions,
): InstallWorkflow<void> {
  const manifestPath = join(options.destination, 'manifest.json')
  let stage = 0
  return {
    async next() {
      if (stage === 0) {
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{
              id: 'java-runtime-manifest',
              type: 'files',
              files: [{
                path: manifestPath,
                urls: normalizeUrls(options.target.manifest.url, options.apiHost),
                size: options.target.manifest.size,
                checksum: { algorithm: 'sha1', value: options.target.manifest.sha1 },
                validator: 'json',
              }],
            }],
          },
        }
      }

      if (stage === 1) {
        stage += 1
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JavaRuntimeManifest
        const files: InstallFile[] = []
        const operations: InstallMaterializeOperation[] = []
        const outputs: InstallOutput[] = []
        for (const [relative, entry] of Object.entries(manifest.files)) {
          const path = join(options.destination, relative)
          if (entry.type === 'file') {
            files.push({
              path,
              urls: normalizeUrls(entry.downloads.raw.url, options.apiHost),
              size: entry.downloads.raw.size,
              checksum: { algorithm: 'sha1', value: entry.downloads.raw.sha1 },
            })
            if (entry.executable) {
              operations.push({ type: 'chmod', path, mode: 0o755 })
              outputs.push({ path, checksum: { algorithm: 'sha1', value: entry.downloads.raw.sha1 } })
            }
          } else if (entry.type === 'directory') {
            operations.push({ type: 'ensure-directory', path })
          } else {
            operations.push({
              type: 'link',
              source: join(dirname(path), entry.target),
              path,
            })
            outputs.push({ path, validator: 'file' })
          }
        }
        const tasks: InstallTask[] = [{ id: 'java-runtime-files', type: 'files', files }]
        if (operations.length > 0) {
          tasks.push({
            id: 'java-runtime-layout',
            type: 'materialize',
            operations,
            outputs,
            dependsOn: ['java-runtime-files'],
          })
        }
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks,
          },
        }
      }

      return { done: true, result: undefined }
    },
  }
}

export interface ZuluRuntimeInstallWorkflowOptions {
  runtime: ZuluJRE
  destination: string
  executable: string
}

export function createZuluRuntimeInstallWorkflow(
  options: ZuluRuntimeInstallWorkflowOptions,
): InstallWorkflow<void> {
  if (!options.runtime.url.endsWith('.zip') && !options.runtime.url.endsWith('.tar.gz')) {
    throw new Error(`Unsupported archive format: ${options.runtime.url}`)
  }
  const archive = join(options.destination, basename(options.runtime.url))
  let stage = 0
  return {
    async next() {
      if (stage === 0) {
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{
              id: 'zulu-runtime-archive',
              type: 'files',
              files: [{
                path: archive,
                urls: [options.runtime.url],
                size: options.runtime.size,
                checksum: { algorithm: 'sha256', value: options.runtime.sha256 },
                validator: options.runtime.url.endsWith('.zip') ? 'zip' : 'file',
              }],
            }],
          },
        }
      }

      if (stage === 1) {
        stage += 1
        const format = options.runtime.url.endsWith('.zip') ? 'zip' : 'tar.gz'
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{
              id: 'zulu-runtime-extract',
              type: 'materialize',
              operations: [
                {
                  type: 'extract-archive',
                  archive,
                  path: options.destination,
                  format,
                  stripComponents: 1,
                },
                { type: 'remove', path: archive },
              ],
              outputs: [{ path: options.executable, validator: 'file' }],
            }],
          },
        }
      }

      return { done: true, result: undefined }
    },
  }
}
