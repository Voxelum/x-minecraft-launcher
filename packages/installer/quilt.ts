import { MinecraftFolder, MinecraftLocation, Version } from '@xmcl/core'
import { readFile } from 'fs/promises'
import { type InstallManifest, type InstallWorkflow } from './installManifest'
import { InstallOptions } from './utils'
import { DEFAULT_META_URL_QUILT } from './quilt.browser'
import { doFetch, FetchOptions } from './utils.browser'

export {
  DEFAULT_META_URL_QUILT,
  getQuiltGames,
  getQuiltLoaders,
  getQuiltLoaderVersionsByMinecraft,
} from './quilt.browser'
export type { GetQuiltOptions, QuiltLoaderArtifact } from './quilt.browser'

export interface InstallQuiltVersionOptions extends FetchOptions, InstallOptions {
  minecraftVersion: string
  version: string
  minecraft: MinecraftLocation
  side?: 'client' | 'server'
}

export interface QuiltInstallWorkflowOptions extends InstallQuiltVersionOptions {
  profileUrls?: string[]
}

export function createQuiltInstallWorkflow(
  options: QuiltInstallWorkflowOptions,
): InstallWorkflow<string> {
  const side = options.side ?? 'client'
  const url = side === 'client'
    ? `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
    : `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const minecraft = MinecraftFolder.from(options.minecraft)
  const checkpoint = minecraft.getPath('versions', '.install', `quilt-${options.minecraftVersion}-${options.version}-${side}.json`)
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
              id: 'quilt-profile',
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
        const resolved = resolveQuiltProfileInstallManifest(content, options)
        version = resolved.version
        resolved.plan.tasks.push({
          id: 'quilt-profile-cleanup',
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

export async function resolveQuiltInstallManifest(
  options: InstallQuiltVersionOptions,
): Promise<{ version: string; plan: InstallManifest }> {
  const side = options.side ?? 'client'
  const url =
    side === 'client'
      ? `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
      : `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const response = await doFetch(options, url)
  const content: Version = (await response.json()) as any

  return resolveQuiltProfileInstallManifest(content, options)
}

export function resolveQuiltProfileInstallManifest(
  content: Version,
  options: InstallQuiltVersionOptions,
): { version: string; plan: InstallManifest } {
  content = structuredClone(content)
  const side = options.side ?? 'client'

  const minecraft = MinecraftFolder.from(options.minecraft)
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom
    content.id = options.versionId || `${options.inheritsFrom}-quilt${options.version}`
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-quilt${options.version}`
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
        id: 'quilt-version-json',
        type: 'materialize',
        operations: [{ type: 'write', path: jsonPath, content: JSON.stringify(content) }],
        outputs: [{ path: jsonPath, validator: 'json' }],
      }],
    },
  }
}
