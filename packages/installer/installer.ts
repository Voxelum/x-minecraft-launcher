import {
  getResolvedVersionHeader,
  MinecraftFolder,
  type ResolvedLibrary,
  type ResolvedServerVersion,
  type ResolvedVersion,
} from '@xmcl/core'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { diagnoseVersionAssets } from './assets'
import { diagnoseFile, type DiagnoseOptions } from './diagnose'
import { type InstallIssue } from './error'
import { diagnoseLibraries } from './libraries'
import { diagnoseProfile, type InstallProfile } from './profile'

async function readProfile(versionDir: string) {
  return readFile(join(versionDir, 'install_profile.json'), 'utf8')
    .then((content) => JSON.parse(content) as InstallProfile)
    .catch(() => undefined)
}

function classifyLibraries(version: ResolvedVersion, libraries: ResolvedLibrary[], issue: InstallIssue) {
  const optifines: ResolvedLibrary[] = []
  const forges: ResolvedLibrary[] = []
  const others: ResolvedLibrary[] = []
  for (const library of libraries) {
    if (library.groupId === 'optifine') {
      optifines.push(library)
    } else if (
      library.groupId === 'net.minecraftforge' &&
      library.artifactId === 'forge' &&
      (library.classifier === 'client' || !library.classifier)
    ) {
      forges.push(library)
    } else {
      others.push(library)
    }
  }
  if (others.length > 0) issue.libraries = others
  if (optifines.length > 0) issue.optifine = optifines[0].version
  if (forges.length > 0) {
    const header = getResolvedVersionHeader(version)
    if (header.forge && header.minecraft) {
      issue.forge = { minecraft: header.minecraft, version: header.forge }
    }
  }
}

export async function diagnoseInstallation(
  version: ResolvedVersion,
  options: DiagnoseOptions = {},
): Promise<InstallIssue | undefined> {
  const issue: InstallIssue = {}
  const folder = MinecraftFolder.from(version.minecraftDirectory)
  const jar = version.downloads.client
  if (jar) {
    const jarIssue = await diagnoseFile(
      {
        file: folder.getVersionJar(version.minecraftVersion, 'client'),
        expectedChecksum: jar.sha1,
        role: 'minecraftClientJar',
        hint: 'Reinstall the client version.',
      },
      options,
    )
    if (jarIssue) issue.jar = version.id
  }

  const profile = await readProfile(folder.getVersionRoot(version.id))
  if (profile && await diagnoseProfile(profile, folder, 'client', options)) issue.profile = profile

  const libraries = await diagnoseLibraries(version.libraries, folder, options)
  if (libraries.length > 0) classifyLibraries(version, libraries, issue)

  Object.assign(issue, await diagnoseVersionAssets(version, {
    ...options,
    useHashForAssetsIndex: true,
  }))
  return Object.keys(issue).length > 0 ? issue : undefined
}

export async function diagnoseServerInstallation(
  version: ResolvedServerVersion,
  minecraft: MinecraftFolder,
  baseVersion: ResolvedVersion,
  options: DiagnoseOptions = {},
): Promise<InstallIssue | undefined> {
  const issue: InstallIssue = {}
  const jarPath = version.jar
    ? minecraft.getLibraryByPath(version.jar)
    : minecraft.getVersionJar(version.minecraftVersion, 'server')
  const jarIssue = await diagnoseFile(
    {
      file: jarPath,
      expectedChecksum: baseVersion.downloads.server?.sha1 ?? '',
      role: 'minecraftServerJar',
      hint: 'Reinstall the server version.',
    },
    options,
  )
  if (jarIssue) issue.jar = version.id

  const libraries = await diagnoseLibraries(version.libraries, minecraft, options)
  if (libraries.length > 0) issue.libraries = libraries

  const profile = await readProfile(minecraft.getVersionRoot(version.id))
  if (profile && await diagnoseProfile(profile, minecraft, 'server', options)) issue.profile = profile
  return Object.keys(issue).length > 0 ? issue : undefined
}