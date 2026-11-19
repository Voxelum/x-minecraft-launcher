import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { readFile } from 'fs/promises'
import type { JavaRuntimeManifest, JavaRuntimeTarget } from './java-runtime.browser'
import type {
  InstallFile,
  InstallMaterializeOperation,
  InstallOutput,
  InstallWorkflow,
  InstallTask,
} from './installManifest'
import type { WithDownload } from './tracker'

/** Resolve a manifest-controlled path and reject paths outside the runtime root. */
function resolveRuntimePath(destination: string, path: string, description: string): string {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    isAbsolute(path) ||
    /^[A-Za-z]:/.test(path)
  ) {
    throw new Error(`Unsafe ${description} in Java runtime manifest: ${path}`)
  }
  const root = resolve(destination)
  const output = resolve(root, path)
  const relativePath = relative(root, output)
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Unsafe ${description} in Java runtime manifest: ${path}`)
  }
  return output
}

function resolveRuntimeLink(
  destination: string,
  outputPath: string,
  target: string,
  description: string,
): string {
  if (
    !target ||
    target.includes('\\') ||
    target.includes('\0') ||
    isAbsolute(target) ||
    /^[A-Za-z]:/.test(target)
  ) {
    throw new Error(`Unsafe symbolic link in Java runtime manifest: ${description}`)
  }
  const root = resolve(destination)
  const source = resolve(dirname(outputPath), target)
  const relativePath = relative(root, source)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Unsafe symbolic link in Java runtime manifest: ${description}`)
  }
  return source
}

function createJavaRuntimeFilesPlan(
  manifest: JavaRuntimeManifest,
  destination: string,
  apiHost?: string | string[],
) {
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    throw new Error('Invalid Java runtime manifest: files must be an object')
  }

  const files: InstallFile[] = []
  const operations: InstallMaterializeOperation[] = []
  const links: InstallMaterializeOperation[] = []
  const outputs: InstallOutput[] = []
  for (const [relativePath, entry] of Object.entries(manifest.files)) {
    const path = resolveRuntimePath(destination, relativePath, 'path')
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid Java runtime manifest entry: ${relativePath}`)
    }
    if (entry.type === 'file') {
      const raw = entry.downloads?.raw
      if (
        !raw ||
        typeof raw.url !== 'string' ||
        !raw.url.startsWith('https://') ||
        typeof raw.sha1 !== 'string' ||
        !raw.sha1 ||
        !Number.isFinite(raw.size) ||
        raw.size < 0
      ) {
        throw new Error(`Invalid download entry in Java runtime manifest: ${relativePath}`)
      }
      files.push({
        path,
        urls: normalizeUrls(raw.url, apiHost),
        size: raw.size,
        checksum: { algorithm: 'sha1', value: raw.sha1 },
      })
      if (entry.executable) {
        operations.push({ type: 'chmod', path, mode: 0o755 })
        outputs.push({ path, checksum: { algorithm: 'sha1', value: raw.sha1 } })
      }
    } else if (entry.type === 'directory') {
      operations.push({ type: 'ensure-directory', path })
    } else if (entry.type === 'link' && typeof entry.target === 'string') {
      const targetPath = resolveRuntimeLink(destination, path, entry.target, relativePath)
      const target = relative(dirname(path), targetPath).split(sep).join('/')
      links.push({ type: 'symlink', target, path })
      outputs.push({ path, validator: 'exists' })
    } else {
      throw new Error(`Invalid Java runtime manifest entry: ${relativePath}`)
    }
  }

  const tasks: InstallTask[] = [{ id: 'java-runtime-files', type: 'files', files }]
  if (operations.length > 0 || links.length > 0) {
    tasks.push({
      id: 'java-runtime-layout',
      type: 'materialize',
      operations: [...operations, ...links],
      outputs,
      dependsOn: ['java-runtime-files'],
    })
  }
  return { schemaVersion: 1 as const, tasks }
}

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

/** Build the download/extraction stage from an already fetched runtime manifest. */
export function createJavaRuntimeManifestInstallWorkflow(
  manifest: JavaRuntimeManifest,
  destination: string,
): InstallWorkflow<void> {
  let stage = 0
  return {
    async next() {
      if (stage++ === 0) {
        return { done: false, plan: createJavaRuntimeFilesPlan(manifest, destination) }
      }
      return { done: true, result: undefined }
    },
  }
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
            tasks: [
              {
                id: 'java-runtime-manifest',
                type: 'files',
                files: [
                  {
                    path: manifestPath,
                    urls: normalizeUrls(options.target.manifest.url, options.apiHost),
                    size: options.target.manifest.size,
                    checksum: { algorithm: 'sha1', value: options.target.manifest.sha1 },
                    validator: 'json',
                  },
                ],
              },
            ],
          },
        }
      }

      if (stage === 1) {
        stage += 1
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as JavaRuntimeManifest
        return {
          done: false,
          plan: createJavaRuntimeFilesPlan(manifest, options.destination, options.apiHost),
        }
      }

      return { done: true, result: undefined }
    },
  }
}

export interface JavaArchiveInstallWorkflowOptions {
  url: string
  checksum: { algorithm: string; value: string }
  destination: string
}

/** Install a vendor-supplied ZIP or TAR.GZ Java distribution. */
export function createJavaArchiveInstallWorkflow(
  options: JavaArchiveInstallWorkflowOptions,
): InstallWorkflow<void> {
  const url = new URL(options.url)
  const filename = basename(url.pathname)
  const format = filename.toLowerCase().endsWith('.zip')
    ? 'zip'
    : filename.toLowerCase().endsWith('.tar.gz')
      ? 'tar.gz'
      : undefined
  if (!format) throw new Error(`Unsupported Java archive format: ${filename}`)
  const archive = join(options.destination, filename)
  let stage = 0
  return {
    async next() {
      if (stage++ === 0) {
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [
              {
                id: 'java-vendor-archive',
                type: 'files',
                files: [
                  {
                    path: archive,
                    urls: [options.url],
                    checksum: options.checksum,
                    validator: format === 'zip' ? 'zip' : 'file',
                  },
                ],
              },
            ],
          },
        }
      }
      if (stage === 2) {
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [
              {
                id: 'java-vendor-extract',
                type: 'materialize',
                operations: [
                  {
                    type: 'extract-archive',
                    archive,
                    path: options.destination,
                    // Extract unchanged; the runtime installer handles optional wrappers.
                    format,
                  },
                  { type: 'remove', path: archive },
                ],
                outputs: [],
              },
            ],
          },
        }
      }
      return { done: true, result: undefined }
    },
  }
}
