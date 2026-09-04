import type { Version } from '@xmcl/core'
import { MinecraftFolder, MinecraftLocation } from '@xmcl/core'
import { readFile } from 'fs/promises'
import { DEFAULT_META_URL_FABRIC, FabricLoaderArtifact } from './fabric.browser'
import { type InstallManifest, type InstallWorkflow } from './installManifest'
import { InstallOptions } from './utils'
import { doFetch, FetchOptions } from './utils.browser'

export interface FabricInstallOptions extends InstallOptions {
  side?: 'client' | 'server'
}

/**
 * Generate fabric version json from loader artifact.
 * @param loader The fabric loader artifact
 * @param side The side of the fabric
 * @param options
 * @returns The generated version json
 */
export function getVersionJsonFromLoaderArtifact(
  loader: FabricLoaderArtifact,
  side: 'client' | 'server',
  options: FabricInstallOptions = {},
) {
  const mcversion = loader.intermediary.version
  const id = options.versionId || `${mcversion}-fabric${loader.loader.version}`
  const libraries = [
    { name: loader.loader.maven, url: 'https://maven.fabricmc.net/' },
    { name: loader.intermediary.maven, url: 'https://maven.fabricmc.net/' },
    ...loader.launcherMeta.libraries.common,
    ...loader.launcherMeta.libraries[side],
  ]
  const mainClass = loader.launcherMeta.mainClass[side]
  const inheritsFrom = options.inheritsFrom || mcversion

  return {
    id,
    inheritsFrom,
    mainClass,
    libraries,
    arguments: {
      game: [],
      jvm: [],
    },
    releaseTime: new Date().toJSON(),
    time: new Date().toJSON(),
  }
}

export function resolveFabricLoaderArtifactPlan(
  loader: FabricLoaderArtifact,
  minecraft: MinecraftLocation,
  options: FabricInstallOptions = {},
): { version: string; plan: InstallManifest } {
  const folder = MinecraftFolder.from(minecraft)
  const side = options.side || 'client'
  const version = getVersionJsonFromLoaderArtifact(loader, side, options)
  const path = side === 'client'
    ? folder.getVersionJson(version.id)
    : folder.getVersionServerJson(version.id)
  return {
    version: version.id,
    plan: {
      schemaVersion: 1,
      tasks: [{
        id: 'fabric-version-json',
        type: 'materialize',
        operations: [{ type: 'write', path, content: JSON.stringify(version, null, 4) }],
        outputs: [{ path, validator: 'json' }],
      }],
    },
  }
}

export interface InstallFabricVersionOptions extends FetchOptions, InstallOptions {
  minecraftVersion: string
  version: string
  minecraft: MinecraftLocation
  side?: 'client' | 'server'
}

export interface FabricInstallWorkflowOptions extends InstallFabricVersionOptions {
  profileUrls?: string[]
}

export function createFabricInstallWorkflow(
  options: FabricInstallWorkflowOptions,
): InstallWorkflow<string> {
  const side = options.side ?? 'client'
  const url = side === 'client'
    ? `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
    : `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const minecraft = MinecraftFolder.from(options.minecraft)
  const checkpoint = minecraft.getPath('versions', '.install', `fabric-${options.minecraftVersion}-${options.version}-${side}.json`)
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
              id: 'fabric-profile',
              type: 'files',
              files: [{
                path: checkpoint,
                urls: options.profileUrls ?? [url],
                validator: 'json',
                replace: true,
              }],
            }],
          },
        }
      }
      if (stage === 1) {
        stage += 1
        const content = JSON.parse(await readFile(checkpoint, 'utf8')) as Version
        const resolved = resolveFabricProfileInstallManifest(content, options)
        version = resolved.version
        resolved.plan.tasks.push({
          id: 'fabric-profile-cleanup',
          type: 'materialize',
          operations: [{ type: 'remove', path: checkpoint }],
          outputs: [],
        })
        return { done: false, plan: resolved.plan }
      }
      return { done: true, result: version }
    },
  }
}

export async function resolveFabricInstallManifest(
  options: InstallFabricVersionOptions,
): Promise<{ version: string; plan: InstallManifest }> {
  const side = options.side ?? 'client'
  const url =
    side === 'client'
      ? `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
      : `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const response = await doFetch(options, url)
  const content: Version = (await response.json()) as any

  return resolveFabricProfileInstallManifest(content, options)
}

export function resolveFabricProfileInstallManifest(
  content: Version,
  options: InstallFabricVersionOptions,
): { version: string; plan: InstallManifest } {
  content = structuredClone(content)
  const side = options.side ?? 'client'

  const minecraft = MinecraftFolder.from(options.minecraft)
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom
    content.id = options.versionId || `${options.inheritsFrom}-fabric${options.version}`
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-fabric${options.version}`
  }

  const jsonPath =
    side === 'client'
      ? minecraft.getVersionJson(content.id)
      : minecraft.getVersionServerJson(content.id)

  return {
    version: content.id,
    plan: {
      schemaVersion: 1,
      tasks: [{
        id: 'fabric-version-json',
        type: 'materialize',
        operations: [{ type: 'write', path: jsonPath, content: JSON.stringify(content) }],
        outputs: [{ path: jsonPath, validator: 'json' }],
      }],
    },
  }
}
