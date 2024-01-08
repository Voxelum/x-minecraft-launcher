import { Version } from '@xmcl/core'
import { isNotNull } from '@xmcl/core/utils'
import { CreateInstanceOption, filterForgeVersion, filterOptifineVersion, findLabyModVersion, findNeoForgedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, isQuiltLibrary } from '@xmcl/runtime-api'
import { readFile, readdir } from 'fs-extra'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { VersionMetadataService } from '~/install'
import { LauncherProfile } from '~/launchProfile'
import { Logger } from '~/logger'
import { discover } from './InstanceFileDiscover'

export async function parseVanillaInstance(path: string, versionMetadataService: VersionMetadataService) {
  const launcherProfilePath = join(path, 'launcher_profiles.json')
  const launcherProfile: LauncherProfile = await readFile(launcherProfilePath, 'utf8').then(JSON.parse)

  const options = await Promise.all(Object.values(launcherProfile.profiles ?? {}).map(async (profile) => {
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

  return options.filter(isNotNull)
}

export async function parseVanillaInstanceFiles(instancePath: string, logger: Logger) {
  const _files = await discover(instancePath, logger)
  for (const [f] of _files) {
    f.downloads = [pathToFileURL(join(instancePath, f.path)).toString()]
  }
  return _files.map(([file]) => file)
}
