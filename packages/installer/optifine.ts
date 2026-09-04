import { ClassReader, ClassVisitor, Opcodes } from '@xmcl/asm'
import { MinecraftFolder, MinecraftLocation, Version } from '@xmcl/core'
import { getEntriesRecord, open, readAllEntries, readEntry } from '@xmcl/unzip'
import {
  type InstallMaterializeOperation,
  type InstallOutput,
  type InstallManifest,
} from './installManifest'
import { Tracker, WithProgress } from './tracker'
import { InstallOptions, SpawnJavaOptions, spawnProcess } from './utils'

export interface OptifineTrackerEvents {
  'optifine.unpack': WithProgress<{ version: string; path: string; minecraft: string }>
}

export interface InstallOptifineOptions extends InstallOptions, SpawnJavaOptions {
  /**
   * Use "optifine.OptiFineForgeTweaker" instead of "optifine.OptiFineTweaker" for tweakClass.
   *
   * If you want to install upon forge, you should use this.
   */
  useForgeTweaker?: boolean
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<OptifineTrackerEvents>

  signal?: AbortSignal
}

/**
 * Generate the optifine version json from provided info.
 * @param editionRelease The edition + release with _
 * @param minecraftVersion The minecraft version
 * @param launchWrapperVersion The launch wrapper version
 * @param options The install options
 * @beta Might be changed and don't break the major version
 */
export function generateOptifineVersion(
  editionRelease: string,
  minecraftVersion: string,
  launchWrapperVersion?: string,
  options: InstallOptifineOptions = {},
): Version {
  const id = options.versionId ?? `${minecraftVersion}-Optifine_${editionRelease}`
  const inheritsFrom = options.inheritsFrom ?? minecraftVersion
  const mainClass = 'net.minecraft.launchwrapper.Launch'
  const libraries = [{ name: `optifine:Optifine:${minecraftVersion}_${editionRelease}` }]
  if (launchWrapperVersion) {
    libraries.unshift({ name: `optifine:launchwrapper-of:${launchWrapperVersion}` })
  } else {
    libraries.unshift({ name: 'net.minecraft:launchwrapper:1.12' })
  }
  return {
    id,
    inheritsFrom,
    arguments: {
      game: [
        '--tweakClass',
        options.useForgeTweaker ? 'optifine.OptiFineForgeTweaker' : 'optifine.OptiFineTweaker',
      ],
      jvm: [],
    },
    releaseTime: new Date().toJSON(),
    time: new Date().toJSON(),
    type: 'release',
    libraries,
    mainClass,
    minimumLauncherVersion: 21,
  }
}

export async function resolveOptifineInstallManifest(
  installer: string,
  minecraft: MinecraftLocation,
  options: InstallOptifineOptions = {},
): Promise<{ version: string; plan: InstallManifest }> {
  options.signal?.throwIfAborted()

  const mc = MinecraftFolder.from(minecraft)

  const zip = await open(installer)
  const entries = await readAllEntries(zip)
  const record = getEntriesRecord(entries)

  const entry =
    record['net/optifine/Config.class'] ??
    record['Config.class'] ??
    record['notch/net/optifine/Config.class']
  if (!entry) {
    throw new BadOptifineJarError(installer, 'net/optifine/Config.class')
  }

  const launchWrapperVersionEntry = record['launchwrapper-of.txt']
  const launchWrapperVersion = launchWrapperVersionEntry
    ? await readEntry(zip, launchWrapperVersionEntry).then((b) => b.toString())
    : undefined

  const buf = await readEntry(zip, entry)
  const reader = new ClassReader(buf)
  class OptifineVisitor extends ClassVisitor {
    fields: Record<string, any> = {}
    visitField(access: number, name: string, desc: string, signature: string, value: any) {
      this.fields[name] = value
      return null
    }
  }
  const visitor = new OptifineVisitor(Opcodes.ASM5)
  reader.accept(visitor)
  const mcversion: string = visitor.fields.MC_VERSION // 1.14.4
  const edition: string = visitor.fields.OF_EDITION // HD_U
  const release: string = visitor.fields.OF_RELEASE // F5
  const editionRelease = edition + '_' + release

  const versionJSON = generateOptifineVersion(
    editionRelease,
    mcversion,
    launchWrapperVersion,
    options,
  )
  const versionJSONPath = mc.getVersionJson(versionJSON.id)

  const launchWrapperEntry = record[`launchwrapper-of-${launchWrapperVersion}.jar`]
  const materialize: InstallMaterializeOperation[] = [{
    type: 'write' as const,
    path: versionJSONPath,
    content: JSON.stringify(versionJSON, null, 4),
  }]
  const materializedOutputs: InstallOutput[] = [{ path: versionJSONPath, validator: 'json' }]
  if (launchWrapperEntry) {
    const wrapperDest = mc.getLibraryByPath(
      `optifine/launchwrapper-of/${launchWrapperVersion}/launchwrapper-of-${launchWrapperVersion}.jar`,
    )
    materialize.push({
      type: 'extract',
      archive: installer,
      entry: launchWrapperEntry.fileName,
      path: wrapperDest,
    })
    materializedOutputs.push({ path: wrapperDest, validator: 'file' })
  }

  const dest = mc.getLibraryByPath(
    `optifine/Optifine/${mcversion}_${editionRelease}/Optifine-${mcversion}_${editionRelease}.jar`,
  )
  const mcJar = mc.getVersionJar(mcversion)
  return {
    version: versionJSON.id,
    plan: {
      schemaVersion: 1,
      tasks: [
        {
          id: 'optifine-materialize',
          type: 'materialize',
          operations: materialize,
          outputs: materializedOutputs,
        },
        {
          id: 'optifine-patcher',
          type: 'java',
          strategies: [[{
            executable: options.java ?? 'java',
            args: ['-cp', installer, 'optifine.Patcher', mcJar, installer, dest],
          }]],
          outputs: [{ path: dest, validator: 'zip' }],
        },
      ],
    },
  }
}

export class BadOptifineJarError extends Error {
  constructor(
    public optifine: string,
    /**
     * What entry in jar is missing
     */
    public entry: string,
  ) {
    super(`Missing entry ${entry} in optifine installer: ${optifine}`)
  }

  error = 'BadOptifineJarError'
}
