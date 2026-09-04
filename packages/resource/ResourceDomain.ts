export const enum ResourceDomain {
  Mods = 'mods',
  ResourcePacks = 'resourcepacks',
  ShaderPacks = 'shaderpacks',
  /**
   * Blueprints / schematics. Stored under the `schematics` folder so it lines
   * up with Litematica's default location.
   */
  Blueprints = 'schematics',
  Unclassified = 'unclassified',
}

export function getResourceTaskPriority(domain: ResourceDomain) {
  if (domain === ResourceDomain.Mods) return -1
  if (domain === ResourceDomain.ResourcePacks) return -2
  if (domain === ResourceDomain.ShaderPacks) return -3
  return -4
}
