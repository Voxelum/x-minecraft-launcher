import { Blueprint, BLUEPRINT_EXTENSIONS, BlueprintFormat } from './model'
import { readBuildingGadget } from './formats/buildingGadget'
import { readLitematic } from './formats/litematica'
import { readSponge } from './formats/sponge'
import { readStructure } from './formats/structure'

/**
 * Detect the {@link BlueprintFormat} of a file from its name.
 */
export function detectFormat(fileName: string): BlueprintFormat | undefined {
  const lower = fileName.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot === -1) return undefined
  return BLUEPRINT_EXTENSIONS[lower.slice(dot)]
}

export function isBlueprintFile(fileName: string) {
  return detectFormat(fileName) !== undefined
}

/**
 * Read any supported blueprint file into the normalized {@link Blueprint} model.
 */
export async function readBlueprint(data: Uint8Array, fileName: string): Promise<Blueprint> {
  const format = detectFormat(fileName)
  switch (format) {
    case BlueprintFormat.Litematic:
      return readLitematic(data)
    case BlueprintFormat.Structure:
      return readStructure(data)
    case BlueprintFormat.BuildingGadget:
      return readBuildingGadget(data)
    case BlueprintFormat.Schem:
    case BlueprintFormat.Schematic:
      return readSponge(data)
    default:
      // Sniff: JSON starts with '{' / whitespace.
      if (data.length > 0 && (data[0] === 0x7b || data[0] === 0x5b)) {
        return readBuildingGadget(data)
      }
      return readSponge(data)
  }
}
