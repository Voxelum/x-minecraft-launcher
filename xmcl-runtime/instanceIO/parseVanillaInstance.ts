import { Version } from '@xmcl/core'
import { isNotNull } from '@xmcl/core/utils'
import { CreateInstanceOption, filterForgeVersion, filterOptifineVersion, findLabyModVersion, findNeoForgedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, isQuiltLibrary, RuntimeVersions } from '@xmcl/runtime-api'
import { readFile, readdir } from 'fs-extra'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { VersionMetadataService } from '~/install'
import { LauncherProfile } from '~/launchProfile'
import { Logger } from '~/logger'
import { discover } from './InstanceFileDiscover'
import { isFulfilled } from '~/util/object'
import { splitCommandLine } from '~/util/cmd'

const enum PCLRamType {
  Global = 2,
  Auto = 0,
  Custom = 1,
}
interface PCLSetup {
  VersionFabric: string
  VersionOptifine: string
  VersionForge: string
  Logo: string
  VersionNeoForge: string
  VersionQuilt: string

  VersionRamType?: PCLRamType
  VersionRamCustom?: string

  VersionOriginal: string

  VersionAdvanceJvm?: string
  VersionAdvanceGame?: string
  VersionAdvanceRun?: string
  VersionServerEnter?: string
}

function getRamFromPCLRamRange(value: number) {
  if (value <= 12) {
    return (3 + value) * 10
  }
  if (value <= 25) {
    return (3 + value + (value - 12) * 5) * 10
  }
  if (value <= 33) {
    return (80 + (value - 25) * 10) * 10
  }
  return (160 + (value - 33) * 20) * 10
}

async function parsePCLInstance(path: string, options: CreateInstanceOption) {
  const pclSetupIniPath = join(path, 'PCL', 'Setup.ini')
  const content = await readFile(pclSetupIniPath, 'utf8')
  const lines = content.split('\n').map(l => l.trim()).filter(l => !!l)
  const record = lines.reduce((acc, line) => {
    const start = line.indexOf(':')
    const key = line.slice(0, start).trim()
    const value = line.slice(start + 1).trim()
    acc[key] = value
    return acc
  }, {} as any) as PCLSetup

  const runtime: RuntimeVersions = {
    minecraft: record.VersionOriginal,
    forge: record.VersionForge,
    fabricLoader: record.VersionFabric,
    neoForged: record.VersionNeoForge,
    quiltLoader: record.VersionQuilt,
  }

  if (record.VersionRamType !== undefined) {
    options.assignMemory = record.VersionRamType === PCLRamType.Auto
      ? 'auto'
      : record.VersionRamType === PCLRamType.Custom
        ? true
        : undefined

    options.minMemory = getRamFromPCLRamRange(Number(record.VersionRamCustom))
  }

  if (!options.runtime) {
    options.runtime = runtime
  } else {
    if (!options.runtime.minecraft) options.runtime.minecraft = runtime.minecraft
    if (!options.runtime.forge) options.runtime.forge = runtime.forge
    if (!options.runtime.fabricLoader) options.runtime.fabricLoader = runtime.fabricLoader
    if (!options.runtime.neoForged) options.runtime.neoForged = runtime.neoForged
    if (!options.runtime.quiltLoader) options.runtime.quiltLoader = runtime.quiltLoader
  }

  if (record.Logo && record.Logo.indexOf(':') === -1) {
    try {
      const logoPath = resolve(path, record.Logo)
      // read and convert logo to base64 dataurl
      const logoData = await readFile(logoPath)
      const base64 = logoData.toString('base64')
      const dataUrl = `data:image/png;base64,${base64}`
      options.icon = dataUrl
    } catch { }
  }

  if (record.VersionAdvanceJvm) {
    const args = splitCommandLine(record.VersionAdvanceJvm)
    options.vmOptions = args
  }
  if (record.VersionAdvanceGame) {
    const args = splitCommandLine(record.VersionAdvanceGame)
    options.mcOptions = args
  }
  if (record.VersionAdvanceRun) {
    options.prependCommand = record.VersionAdvanceRun
  }
  if (record.VersionServerEnter) {
    const [host, port] = record.VersionServerEnter.split(':')
    options.server = {
      host,
      port: port ? Number(port) : undefined,
    }
  }

  options.resourcepacks = true
  options.shaderpacks = true
}

export async function parseVanillaInstance(path: string, versionMetadataService: VersionMetadataService) {
  const launcherProfilePath = join(path, 'launcher_profiles.json')
  const launcherProfile: LauncherProfile = await readFile(launcherProfilePath, 'utf8').then(JSON.parse)

  const versions = await readdir(resolve(path, 'versions'))

  const options = await Promise.allSettled(Object.values(launcherProfile.profiles ?? {}).map(async (profile) => {
    if (profile.type && profile.type !== 'custom') {
      const type = profile.type // either 'latest-release' or 'latest-snapshot'
      const id = type === 'latest-release' ? versionMetadataService.getLatestRelease() : versionMetadataService.getLatestSnapshot()

      const options: CreateInstanceOption = {
        name: profile.name || (type === 'latest-release' ? 'Minecraft' : 'Minecraft Snapshot'),
        java: profile.javaDir,
        vmOptions: profile.javaArgs?.split(' ') || [],
        runtime: {
          minecraft: id,
        },
        icon: profile.icon,
      }
      const versionRoot = resolve(path, 'versions', id)
      const files = (await readdir(versionRoot).catch(() => [])).filter(f => f !== '.DS_Store' && f !== `${id}.json` && f !== `${id}.jar`)
      const isIsolated = files.some(f => f === 'saves' || f === 'mods' || f === 'options.txt' || f === 'config' || f === 'PCL')
      return {
        options,
        isIsolated,
        path: join(path, 'versions', id),
      }
    }

    const id = profile.lastVersionId
    const versionRoot = resolve(path, 'versions', id)
    if (versions.includes(id)) {
      versions.splice(versions.indexOf(id), 1)
    }
    const files = (await readdir(versionRoot).catch(() => [])).filter(f => f !== '.DS_Store' && f !== `${id}.json` && f !== `${id}.jar`)
    const isIsolated = files.some(f => f === 'saves' || f === 'mods' || f === 'options.txt' || f === 'config' || f === 'PCL')

    const version = await Version.parse(path, id)
    const options: CreateInstanceOption = {
      name: profile.name,
      java: profile.javaDir ? join(profile.javaDir, 'java' + (process.platform === 'win32' ? '.exe' : '')) : undefined,
      vmOptions: profile.javaArgs?.split(' ') || [],
      icon: profile.icon,
      runtime: {
        minecraft: version.minecraftVersion,
        forge: filterForgeVersion(version.libraries.find(isForgeLibrary)?.version ?? ''),
        fabricLoader: version.libraries.find(isFabricLoaderLibrary)?.version ?? '',
        quiltLoader: version.libraries.find(isQuiltLibrary)?.version ?? '',
        optifine: filterOptifineVersion(version.libraries.find(isOptifineLibrary)?.version ?? ''),
        labyMod: findLabyModVersion(version),
        neoForged: findNeoForgedVersion(version.minecraftVersion, version),
      },
    }
    return { options, isIsolated, path: join(path, 'versions', id) }
  }).map((p) => p.catch(() => undefined)))

  const unofficial = await Promise.allSettled(versions.map(async (id) => {
    const versionRoot = resolve(path, 'versions', id)
    const files = (await readdir(versionRoot).catch(() => [])).filter(f => f !== '.DS_Store' && f !== `${id}.json` && f !== `${id}.jar`)
    let isIsolated = files.some(f => f === 'saves' || f === 'mods' || f === 'options.txt' || f === 'config' || f === 'PCL')
    const version = await Version.parse(path, id)
    const options: CreateInstanceOption = {
      name: id,
      runtime: {
        minecraft: version.minecraftVersion,
        forge: filterForgeVersion(version.libraries.find(isForgeLibrary)?.version ?? ''),
        fabricLoader: version.libraries.find(isFabricLoaderLibrary)?.version ?? '',
        quiltLoader: version.libraries.find(isQuiltLibrary)?.version ?? '',
        optifine: filterOptifineVersion(version.libraries.find(isOptifineLibrary)?.version ?? ''),
        labyMod: findLabyModVersion(version),
        neoForged: findNeoForgedVersion(version.minecraftVersion, version),
      },
    }
    if (await parsePCLInstance(versionRoot, options).then(() => true, () => false)) {
      isIsolated = true
    }
    return { options, isIsolated, path: join(path, 'versions', id) }
  }))

  return [...options, ...unofficial].filter(isFulfilled).map(v => v.value).filter(isNotNull)
}

export async function parseVanillaInstanceFiles(instancePath: string, logger: Logger) {
  const _files = await discover(instancePath, logger)
  for (const [f] of _files) {
    f.downloads = [pathToFileURL(join(instancePath, f.path)).toString()]
  }
  return _files.map(([file]) => file)
}
