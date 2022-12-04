import { ForgeModMetadata } from '@xmcl/mod-parser'
import { FabricResource, ForgeResource, isFabricResource, isForgeResource, Resource } from '@xmcl/runtime-api/src/entities/resource'

export type ModDependencies = ModDependency[]

type ModDependency = {
  modId: string
  versionRange: string
  semanticVersion?: string | string[]
} | {
  modId: string
  versionRange?: string
  semanticVersion: string | string[]
}

function parseForgeDependenciesString(dep: string) {
  return dep.split(';')
    .map(d => d.split(':'))
    .filter(d => d[0].startsWith('required'))
    .map(d => d[1].split('@'))
    .map(v => ({ modId: v[0] === 'Forge' ? 'forge' : v[0], versionRange: v[1] ?? '' }))
}

export function getLegacyForgeDependencies(mod: ForgeModMetadata) {
  const mods: ModDependencies = []
  // for legacy mods, we respect annotation more
  for (const anno of mod.modAnnotations) {
    const allDeps: ModDependency[] = []
    // Resolve common dependencies
    if (anno.dependencies) {
      allDeps.push(...parseForgeDependenciesString(anno.dependencies))
    }
    // Resolve Minecraft dependency
    if (anno.acceptedMinecraftVersions) {
      allDeps.push({ modId: 'minecraft', versionRange: anno.acceptedMinecraftVersions })
    } else {
      const mcmodInfo = mod.mcmodInfo.find(m => m.modid === anno.modid)
      if (mcmodInfo && mcmodInfo.mcversion) {
        allDeps.push({ modId: 'minecraft', semanticVersion: `~${mcmodInfo.mcversion}` })
      }
    }

    if (allDeps.every(v => v.modId !== 'forge')) {
      allDeps.push({
        modId: 'forge',
        versionRange: '[*]',
      })
    }

    mods.push(...allDeps)
  }

  return mods
}

export function getFabricModDependencies(resource: FabricResource): ModDependencies {
  const deps = resource.metadata.fabric instanceof Array
    ? resource.metadata.fabric[0].depends
    : resource.metadata.fabric.depends
  const result: ModDependencies = []
  if (deps) {
    for (const [k, v] of Object.entries(deps)) {
      result.push({ modId: k, semanticVersion: v })
    }
  }
  return result
}

export function getForgeModDependencies(resource: ForgeResource): ModDependencies {
  const mods: ModDependencies = []
  if (resource.metadata.forge.modsToml.length > 0) {
    // new mod
    for (const mod of resource.metadata.forge.modsToml) {
      const deps: ModDependencies = []
      for (const dep of mod.dependencies) {
        deps.push({
          modId: dep.modId,
          versionRange: dep.versionRange,
        })
      }
      if (deps.every(d => d.modId !== 'forge')) {
        deps.push({
          modId: 'forge',
          versionRange: mod.loaderVersion,
        })
      }
      mods.push(...deps)
    }
  } else {
    // legacy mod
    mods.push(...getLegacyForgeDependencies(resource.metadata.forge))
  }

  return mods
}

export function getModDependencies(resource: Resource): ModDependencies {
  if (isForgeResource(resource)) {
    return getForgeModDependencies(resource)
  }
  if (isFabricResource(resource)) {
    return getFabricModDependencies(resource)
  }
  return []
}
