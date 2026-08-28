import type { ResourceMetadata } from '@xmcl/resource'
import { lstat, realpath, unlink } from 'fs-extra'
import { dirname, isAbsolute, relative, resolve } from 'path'

export function getModIds(metadata: ResourceMetadata): string[] {
  const result = new Set<string>()
  const add = (id: unknown) => {
    if (typeof id === 'string' && id) result.add(id)
  }

  add(metadata.forge?.modid)
  for (const mod of metadata.forge?.modsToml ?? []) add(mod.modid)
  for (const mod of metadata.forge?.mcmodInfo ?? []) add(mod.modid)
  add(metadata.neoforge?.modid)
  for (const mod of metadata.neoforge?.children ?? []) add(mod.modid)
  const fabric = metadata.fabric
  for (const mod of Array.isArray(fabric) ? fabric : fabric ? [fabric] : []) add(mod.id)
  add(metadata.quilt?.quilt_loader.id)
  add(metadata.liteloader?.name)

  return [...result]
}

export function getRemovableConfigPaths(
  mappings: Record<string, string[]>,
  removedModIds: Iterable<string>,
  installedModIds: Iterable<string>,
): string[] {
  const installedPaths = new Set([...installedModIds].flatMap(id => mappings[id] ?? []))
  return [...new Set([...removedModIds].flatMap(id => mappings[id] ?? []))]
    .filter(path => !installedPaths.has(path))
}

export async function removeMappedConfigFile(instancePath: string, configPath: string): Promise<boolean> {
  if (!configPath || isAbsolute(configPath)) return false
  const configDirectory = resolve(instancePath, 'config')
  const target = resolve(configDirectory, configPath)
  const relativeTarget = relative(configDirectory, target)
  if (!relativeTarget || relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) return false

  const [realConfigDirectory, realParent] = await Promise.all([
    realpath(configDirectory),
    realpath(dirname(target)),
  ]).catch(() => [])
  if (!realConfigDirectory || !realParent) return false
  const relativeParent = relative(realConfigDirectory, realParent)
  if (relativeParent.startsWith('..') || isAbsolute(relativeParent)) return false

  const targetStat = await lstat(target).catch(() => undefined)
  if (!targetStat || (!targetStat.isFile() && !targetStat.isSymbolicLink())) return false
  await unlink(target)
  return true
}
