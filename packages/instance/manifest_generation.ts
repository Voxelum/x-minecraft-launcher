import { join } from 'path'
import { Instance } from './instance'
import { InstanceFile, InstanceManifest } from './files'
import { decorateInstanceFiles, getInstanceFiles } from './files_discovery'
import { ChecksumWorker, Logger, ResourceManager } from './internal_type'
import { Stats } from 'fs-extra'

/**
 * Options for generating instance manifest
 */
export interface GetManifestOptions {
  /**
   * The instance path
   */
  path: string
  /**
   * The hash algorithms to compute for each file
   */
  hashes?: string[]
}

export function shouldBeExcluded(relativePath: string, stat: Stats): boolean {
  if (relativePath.startsWith('.backups')) {
    return true // exclude
  }
  if (relativePath.endsWith('.DS_Store') || relativePath.endsWith('.gitignore')) {
    return true // exclude
  }
  if (relativePath === 'instance.json') {
    return true // exclude
  }
  if (relativePath === 'server' && stat.isDirectory()) {
    return true // exclude
  }
  // Don't share versions/libs/assets
  if (
    relativePath.startsWith('versions') ||
    relativePath.startsWith('assets') ||
    relativePath.startsWith('libraries')
  ) {
    return true // exclude
  }

  return false
}

/**
 * Generate an instance manifest from local files
 * @param undecoratedResources A set to store the no download urls files
 */
export async function generateInstanceManifest(
  options: GetManifestOptions,
  instance: Instance,
  worker: ChecksumWorker,
  resourceManager: ResourceManager,
  logger: Logger,
  undecoratedResources = new Set<InstanceFile>(),
): Promise<InstanceManifest> {
  const instancePath = options.path
  let files: InstanceFile[] = []

  const start = performance.now()

  // Discover all files in the instance
  const fileWithStats = await getInstanceFiles(instancePath, logger, (relativePath, stat) => {
    // Filter out files we don't want in the manifest
    if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
      if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
        return true // exclude
      }
    }
    if (shouldBeExcluded(relativePath, stat)) {
      return true
    }
    // Exclude executables and libraries
    if (
      relativePath.endsWith('.dll') ||
      relativePath.endsWith('.so') ||
      relativePath.endsWith('.exe')
    ) {
      return true // exclude
    }
    return false // include
  })

  const duration = performance.now() - start
  logger.log(`Discover instance files in ${instancePath} in ${duration}ms`)

  const decorateStart = performance.now()
  try {
    await decorateInstanceFiles(
      fileWithStats,
      instancePath,
      worker,
      resourceManager,
      undecoratedResources,
    )
  } catch (e) {
    logger.warn(new Error('Fail to get manifest data for instance file', { cause: e }))
  }
  logger.log(`Decorate instance files in ${instancePath} in ${performance.now() - decorateStart}ms`)

  // Compute additional hashes if requested
  if (options.hashes) {
    const hashStart = performance.now()
    const hashes = options.hashes
    await Promise.all(
      fileWithStats
        .filter(([f]) => {
          for (const h of hashes) {
            if (!f.hashes[h]) {
              return true
            }
          }
          return false
        })
        .map(([f]) =>
          Promise.all(
            hashes.map(async (algorithm) => {
              if (!f.hashes[algorithm]) {
                f.hashes[algorithm] = await worker.checksum(join(instancePath, f.path), algorithm)
              }
            }),
          ),
        ),
    )
    logger.log(`Resolve hashes in ${instancePath} in ${performance.now() - hashStart}ms`)
  }

  files = fileWithStats.map(([file]) => file)

  return {
    files,
    name: instance.name,
    description: instance.description,
    mcOptions: instance.mcOptions,
    vmOptions: instance.vmOptions,
    runtime: instance.runtime,
    maxMemory: instance.maxMemory,
    minMemory: instance.minMemory,
  }
}

/**
 * Generate server-specific manifest (files in server directory)
 */
export async function generateInstanceServerManifest(
  options: GetManifestOptions,
  logger: Logger,
): Promise<InstanceFile[]> {
  const serverPath = join(options.path, 'server')

  const fileWithStats = await getInstanceFiles(serverPath, logger, (filePath) => {
    if (
      filePath.startsWith('libraries') ||
      filePath.startsWith('versions') ||
      filePath.startsWith('assets')
    ) {
      return true // exclude
    }
    if (filePath.endsWith('.DS_Store') || filePath.endsWith('.gitignore')) {
      return true // exclude
    }
    return false // include
  })

  return fileWithStats.map(([file]) => file)
}

/**
 * Default file filter for instance discovery
 */
export function createDefaultFileFilter() {
  return (relativePath: string, stat: any) => {
    // Exclude resource pack and shader pack metadata
    if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
      if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
        return true
      }
    }

    // Exclude system files
    if (
      relativePath.startsWith('.backups') ||
      relativePath.endsWith('.DS_Store') ||
      relativePath.endsWith('.gitignore') ||
      relativePath === 'instance.json'
    ) {
      return true
    }

    // Exclude server directory
    if (relativePath === 'server' && stat.isDirectory()) {
      return true
    }

    // Exclude executables
    if (
      relativePath.endsWith('.dll') ||
      relativePath.endsWith('.so') ||
      relativePath.endsWith('.exe')
    ) {
      return true
    }

    // Exclude Minecraft installation directories
    if (
      relativePath.startsWith('versions') ||
      relativePath.startsWith('assets') ||
      relativePath.startsWith('libraries')
    ) {
      return true
    }

    return false
  }
}
