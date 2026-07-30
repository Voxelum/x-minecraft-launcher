import { Blueprint, BlueprintFormat } from './model'
import { writeBuildingGadget } from './formats/buildingGadget'
import { writeLitematic } from './formats/litematica'
import { writeSponge } from './formats/sponge'
import { writeStructure } from './formats/structure'
import { readBlueprint } from './read'

/**
 * Serialize a {@link Blueprint} into the given format.
 */
export async function writeBlueprint(blueprint: Blueprint, format: BlueprintFormat): Promise<Uint8Array> {
  switch (format) {
    case BlueprintFormat.Litematic:
      return writeLitematic(blueprint)
    case BlueprintFormat.Structure:
      return writeStructure(blueprint)
    case BlueprintFormat.BuildingGadget:
      return writeBuildingGadget(blueprint)
    case BlueprintFormat.Schem:
    case BlueprintFormat.Schematic:
    default:
      return writeSponge(blueprint)
  }
}

/**
 * The file extension that should be used for a given format.
 */
export function extensionForFormat(format: BlueprintFormat): string {
  switch (format) {
    case BlueprintFormat.Litematic:
      return '.litematic'
    case BlueprintFormat.Structure:
      return '.nbt'
    case BlueprintFormat.BuildingGadget:
      return '.json'
    case BlueprintFormat.Schematic:
      return '.schematic'
    case BlueprintFormat.Schem:
    default:
      return '.schem'
  }
}

/**
 * Read a blueprint file and re-encode it into the target format.
 */
export async function convertBlueprint(
  data: Uint8Array,
  fileName: string,
  target: BlueprintFormat,
): Promise<{ data: Uint8Array; extension: string }> {
  const blueprint = await readBlueprint(data, fileName)
  blueprint.format = target
  return {
    data: await writeBlueprint(blueprint, target),
    extension: extensionForFormat(target),
  }
}
