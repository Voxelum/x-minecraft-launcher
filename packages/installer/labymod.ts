/* eslint-disable n/no-unsupported-features/node-builtins */
import { LibraryInfo, MinecraftFolder, MinecraftLocation } from '@xmcl/core'
import { readFile } from 'fs/promises'
import { type InstallFile, type InstallManifest, type InstallWorkflow } from './installManifest'
import {
  LabyModAddon,
  LabyModAddonIndex,
  LabyModManifest,
} from './labymod.browser'
import { Tracker, WithDownload } from './tracker'
import { InstallOptions } from './utils'
import { FetchOptions, doFetch } from './utils.browser'

export interface LabyModTrackerEvents {
  labymod: { version: string; tag: string }
  'labymod.json': { version: string; tag: string }
  'labymod.assets': WithDownload<{ count: number }>
  'labymod.addon': WithDownload<{ namespace: string; name: string }>
}

export interface InstallLabyModOptions extends InstallOptions, FetchOptions {
  environment?: string
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<LabyModTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>
}
export interface InstallLabyModAddonOptions extends FetchOptions {
  environment?: string
  /**
   * Whether to install addon dependencies automatically
   * @default true
   */
  installDependencies?: boolean
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<LabyModTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>
}

interface LabyModLibraryInfo {
  name: string
  url: string
  minecraftVersion: string
  sha1: string
  size: number
  natives: any[]
  resolvedAt: number
}

export function createLabyModInstallWorkflow(
  manifest: LabyModManifest,
  tag: string,
  folder: MinecraftFolder,
  environment = 'production',
): InstallWorkflow<string> {
  const versionInfo = manifest.minecraftVersions.find((version) => version.tag === tag)
  if (!versionInfo) throw new Error(`Cannot find version info for ${tag}`)
  const metadataPath = folder.getPath('versions', '.install', `labymod-libraries-${environment}.json`)
  const versionPath = folder.getPath('versions', '.install', `labymod-version-${tag}.json`)
  let stage = 0
  let version = ''
  return {
    async next() {
      if (stage === 0) {
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{
              id: 'labymod-metadata',
              type: 'files',
              files: [
                {
                  path: metadataPath,
                  urls: [`https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/libraries/${environment}.json`],
                  validator: 'json',
                  replace: true,
                },
                {
                  path: versionPath,
                  urls: [versionInfo.customManifestUrl],
                  validator: 'json',
                  replace: true,
                },
              ],
            }],
          },
        }
      }
      if (stage === 1) {
        stage += 1
        const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as { libraries: LabyModLibraryInfo[] }
        const versionJson = JSON.parse(await readFile(versionPath, 'utf8'))
        const resolved = resolveLabyModMetadataInstallManifest(
          manifest,
          tag,
          folder,
          environment,
          metadata.libraries,
          versionJson,
        )
        version = resolved.version
        resolved.plan.tasks.push({
          id: 'labymod-metadata-cleanup',
          type: 'materialize',
          operations: [
            { type: 'remove', path: metadataPath },
            { type: 'remove', path: versionPath },
          ],
          outputs: [],
        })
        return { done: false, plan: resolved.plan }
      }
      return { done: true, result: version }
    },
  }
}

export async function resolveLabyModInstallManifest(
  manifest: LabyModManifest,
  tag: string,
  folder: MinecraftFolder,
  environment: string,
  options: InstallLabyModOptions,
): Promise<{ version: string; plan: InstallManifest }> {
  const librariesUrl = `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/libraries/${environment}.json`
  const versionInfo = manifest.minecraftVersions.find((v) => v.tag === tag)!

  if (!versionInfo) {
    throw Object.assign(new Error(`Cannot find version info for ${tag}`), {
      name: 'VersionInfoNotFoundError',
    })
  }

  const metadataResponse = await doFetch(options, librariesUrl)

  if (!metadataResponse.ok) {
    throw Object.assign(
      new Error(
        `Failed to fetch libraries metadata: ${metadataResponse.statusText}: ${await metadataResponse.text()}`,
      ),
      {
        name: 'FetchLabyModMetadataError',
      },
    )
  }
  // Get version json and merge with libraries
  const libraries: LabyModLibraryInfo[] = await metadataResponse
    .json()
    .then((res) => res.libraries as LabyModLibraryInfo[])
    .then((libs) =>
      libs.filter((lib) => lib.minecraftVersion === 'all' || lib.minecraftVersion === tag),
    )

  const versionJsonResponse = await doFetch(options, versionInfo.customManifestUrl)

  if (!versionJsonResponse.ok) {
    throw Object.assign(
      new Error(
        `Failed to fetch version json: ${versionJsonResponse.statusText}: ${await versionJsonResponse.text()}`,
      ),
      {
        name: 'FetchLabyModVersionJsonError',
      },
    )
  }
  const versionJson = await versionJsonResponse.json()

  return resolveLabyModMetadataInstallManifest(
    manifest,
    tag,
    folder,
    environment,
    libraries,
    versionJson,
  )
}

export function resolveLabyModMetadataInstallManifest(
  manifest: LabyModManifest,
  tag: string,
  folder: MinecraftFolder,
  environment: string,
  libraries: LabyModLibraryInfo[],
  sourceVersionJson: any,
): { version: string; plan: InstallManifest } {
  const versionJson = structuredClone(sourceVersionJson)

  versionJson.libraries.push(
    ...libraries.map((l) => ({
      name: l.name,
      downloads: {
        artifact: {
          path: LibraryInfo.resolve(l.name).path,
          sha1: l.sha1,
          size: l.size,
          url: l.url,
        },
      },
    })),
    {
      name: `net.labymod:LabyMod:${manifest.labyModVersion}`,
      downloads: {
        artifact: {
          path: `net/labymod/LabyMod/${manifest.labyModVersion}/LabyMod-${manifest.labyModVersion}.jar`,
          sha1: manifest.sha1,
          size: manifest.size,
          url: `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/download/labymod4/${environment}/${manifest.commitReference}.jar`,
        },
      },
    },
  )
  versionJson.id = `${tag}-LabyMod-4-${manifest.commitReference}`

  if (!versionJson.inheritFrom) {
    versionJson.inheritFrom = versionJson._minecraftVersion || tag
  }

  const versionPath = folder.getPath('versions', versionJson.id, `${versionJson.id}.json`)
  const assetEntries = Object.entries(manifest.assets)
  const files: InstallFile[] = assetEntries.map(([name, hash]) => ({
    path: folder.getPath('labymod-neo', 'assets', `${name}.jar`),
    urls: [`https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/download/assets/labymod4/${environment}/${manifest.commitReference}/${name}/${hash}.jar`],
    validator: 'file',
  }))
  return {
    version: versionJson.id,
    plan: {
      schemaVersion: 1,
      tasks: [
        {
          id: 'labymod-version-json',
          type: 'materialize',
          operations: [{ type: 'write', path: versionPath, content: JSON.stringify(versionJson, null, 4) }],
          outputs: [{ path: versionPath, validator: 'json' }],
        },
        { id: 'labymod-assets', type: 'files', files },
      ],
    },
  }
}

/**
 * Check if a LabyMod addon supports a specific Minecraft version
 *
 * @param addon The addon to check
 * @param minecraftVersion The Minecraft version to check (e.g., '1.20.1', '1.21')
 * @returns true if the addon supports the version, false otherwise
 */
export function isLabyModAddonCompatible(
  addon: LabyModAddon | LabyModAddonIndex,
  minecraftVersion: string,
): boolean {
  const versionString = addon.version_string
  if (!versionString || versionString === '*') {
    return true
  }

  // Parse version ranges like "1.16.5<1.21.10" or "1.8.9,1.12.2" or "1.8.9<1.21.8"
  const ranges = versionString.split(',')

  for (const range of ranges) {
    if (range.includes('<')) {
      // Range format: "min<max"
      const [min, max] = range.split('<')
      if (
        compareVersions(minecraftVersion, min.trim()) >= 0 &&
        compareVersions(minecraftVersion, max.trim()) <= 0
      ) {
        return true
      }
    } else {
      // Exact version match
      if (range.trim() === minecraftVersion) {
        return true
      }
    }
  }

  return false
}

/**
 * Compare two Minecraft version strings
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const maxLength = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA !== numB) {
      return numA - numB
    }
  }
  return 0
}
