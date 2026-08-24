import type { JavaVersion } from '@xmcl/core'
import type { InstallIssue } from './error'
import type { InstallResult } from './installManifest'
import type { LabyModManifest } from './labymod.browser'
import type { MinecraftVersion } from './minecraft.browser'

export interface InstanceVersionRuntime {
  minecraft: string
  forge?: string
  neoForged?: string
  fabricLoader?: string
  quiltLoader?: string
  optifine?: string
  labyMod?: string
}

export interface InstanceVersionHeader {
  id: string
}

export interface InstanceVersionJavaPlan {
  preferred?: string
  fallback?: JavaVersion
}

export type InstanceVersionLayer =
  | { type: 'use'; role: 'labymod' | 'forge' | 'neoforge' | 'fabric' | 'quilt' | 'optifine'; version: string }
  | { type: 'labymod'; manifest: LabyModManifest }
  | { type: 'forge'; version: string; installer?: { path: string; sha1?: string } }
  | { type: 'neoforge'; version: string }
  | { type: 'fabric'; loader: string }
  | { type: 'quilt'; loader: string }
  | { type: 'optifine'; version: string }

interface VersionInstallManifestBase {
  schemaVersion: 2
  side: 'client'
  runtime: InstanceVersionRuntime
  java: InstanceVersionJavaPlan
}

export interface VersionFreshInstallManifest extends VersionInstallManifestBase {
  kind: 'install'
  minecraft: MinecraftVersion
  layers: InstanceVersionLayer[]
}

export interface VersionRepairManifest extends VersionInstallManifestBase {
  kind: 'repair'
  version: string
  issue: InstallIssue
}

export type VersionInstallManifest =
  | VersionFreshInstallManifest
  | VersionRepairManifest

export interface InstanceVersionInstallResolver {
  getMinecraftVersion(version: string): Promise<MinecraftVersion | undefined>
  findLocalVersion(runtime: InstanceVersionRuntime): Promise<InstanceVersionHeader | undefined>
  getForgeVersion?(minecraft: string, forge: string): Promise<{
    version: string
    installer?: { path: string; sha1?: string }
  } | undefined>
  getNeoForgedVersion?(minecraft: string, neoForged: string): Promise<string | undefined>
  getLabyModManifest?(): Promise<LabyModManifest>
}

export interface ResolveInstanceVersionInstallOptions {
  runtime: InstanceVersionRuntime
  resolvedVersion?: string
  issue?: InstallIssue
  preferredJava?: string
  java?: JavaVersion
}

function normalizeOptifineVersion(minecraft: string, optifine: string) {
  return optifine.startsWith(minecraft) ? optifine.substring(minecraft.length) : optifine
}

function createBaseManifest(options: ResolveInstanceVersionInstallOptions): VersionInstallManifestBase {
  return {
    schemaVersion: 2,
    side: 'client',
    runtime: { ...options.runtime },
    java: {
      preferred: options.preferredJava,
      fallback: options.java,
    },
  }
}

async function resolveFreshInstall(
  options: ResolveInstanceVersionInstallOptions,
  resolver: InstanceVersionInstallResolver,
): Promise<VersionFreshInstallManifest> {
  const runtime = options.runtime
  const minecraft = await resolver.getMinecraftVersion(runtime.minecraft)
  if (!minecraft) throw new Error(`Cannot find the minecraft version ${runtime.minecraft}`)

  const layers: InstanceVersionLayer[] = []
  if (runtime.labyMod) {
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      labyMod: runtime.labyMod,
    })
    if (local) {
      layers.push({ type: 'use', role: 'labymod', version: local.id })
    } else {
      if (!resolver.getLabyModManifest) throw new Error('LabyMod manifest resolver is unavailable')
      layers.push({ type: 'labymod', manifest: await resolver.getLabyModManifest() })
    }
  }

  if (runtime.forge) {
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      forge: runtime.forge,
      labyMod: runtime.labyMod,
    })
    if (local) {
      layers.push({ type: 'use', role: 'forge', version: local.id })
    } else {
      const forge = await resolver.getForgeVersion?.(runtime.minecraft, runtime.forge)
      layers.push({
        type: 'forge',
        version: forge?.version ?? runtime.forge,
        installer: forge?.installer,
      })
    }
  } else if (runtime.neoForged) {
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      neoForged: runtime.neoForged,
      labyMod: runtime.labyMod,
    })
    if (local) {
      layers.push({ type: 'use', role: 'neoforge', version: local.id })
    } else {
      layers.push({
        type: 'neoforge',
        version: await resolver.getNeoForgedVersion?.(runtime.minecraft, runtime.neoForged) ?? runtime.neoForged,
      })
    }
  }

  if (runtime.optifine) {
    const version = normalizeOptifineVersion(runtime.minecraft, runtime.optifine)
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      forge: runtime.forge,
      neoForged: runtime.neoForged,
      fabricLoader: runtime.fabricLoader,
      quiltLoader: runtime.quiltLoader,
      optifine: version,
      labyMod: runtime.labyMod,
    })
    layers.push(local
      ? { type: 'use', role: 'optifine', version: local.id }
      : { type: 'optifine', version })
  } else if (!runtime.forge && !runtime.neoForged && runtime.fabricLoader) {
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      fabricLoader: runtime.fabricLoader,
      labyMod: runtime.labyMod,
    })
    layers.push(local
      ? { type: 'use', role: 'fabric', version: local.id }
      : { type: 'fabric', loader: runtime.fabricLoader })
  } else if (!runtime.forge && !runtime.neoForged && runtime.quiltLoader) {
    const local = await resolver.findLocalVersion({
      minecraft: runtime.minecraft,
      quiltLoader: runtime.quiltLoader,
      labyMod: runtime.labyMod,
    })
    layers.push(local
      ? { type: 'use', role: 'quilt', version: local.id }
      : { type: 'quilt', loader: runtime.quiltLoader })
  }

  return { ...createBaseManifest(options), kind: 'install', minecraft, layers }
}

export function resolveVersionRepairManifest(
  options: ResolveInstanceVersionInstallOptions & { resolvedVersion: string },
): VersionRepairManifest {
  return {
    ...createBaseManifest(options),
    kind: 'repair',
    version: options.resolvedVersion,
    issue: options.issue ?? {},
  }
}

export async function resolveVersionInstallManifest(
  options: ResolveInstanceVersionInstallOptions,
  resolver: InstanceVersionInstallResolver,
): Promise<VersionInstallManifest> {
  return options.resolvedVersion
    ? resolveVersionRepairManifest({ ...options, resolvedVersion: options.resolvedVersion })
    : resolveFreshInstall(options, resolver)
}

export interface InstanceVersionInstallResult {
  version: string
  timestamp: number
  duration: number
  timings: InstallResult['timings']
}

export interface InstanceVersionInstallLock {
  schemaVersion: 1
  version: string
  timestamp: number
}