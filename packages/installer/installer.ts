import {
  getResolvedVersionHeader,
  MinecraftFolder,
  ResolvedLibrary,
  ResolvedVersion,
} from '@xmcl/core'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { AssetsOptions, AssetsTrackerEvents, installAssets, installResolvedAssets } from './assets'
import { InstallError, InstallIssue, isInstallError, mergeInstallIssue } from './error'
import { installForge } from './forge'
import {
  installLibraries,
  installResolvedLibraries,
  LibrariesTrackerEvents,
  LibraryOptions,
} from './libraries'
import { installMinecraftJar, JarOption, MinecraftTrackerEvents } from './minecraft'
import {
  diagnoseProfile,
  installByProfile,
  InstallProfile,
  InstallProfileOption,
  ProfileTrackerEvents,
} from './profile'
import { Tracker } from './tracker'

export interface CompleteTrackerEvents
  extends
    MinecraftTrackerEvents,
    LibrariesTrackerEvents,
    AssetsTrackerEvents,
    ProfileTrackerEvents {}

export interface CompleteOptions
  extends
    Omit<JarOption, 'tracker'>,
    Omit<LibraryOptions, 'tracker'>,
    Omit<AssetsOptions, 'tracker'>,
    Omit<InstallProfileOption, 'tracker'> {
  /**
   * The tracker to track the complete installation process
   */
  tracker?: Tracker<CompleteTrackerEvents>
}

async function readProfile(versionDir: string) {
  const installProfilePath = join(versionDir, 'install_profile.json')
  try {
    const installProfile: InstallProfile = JSON.parse(await readFile(installProfilePath, 'utf8'))
    return installProfile
  } catch {
    return undefined
  }
}

/**
 * Complete the installation of a resolved version, including minecraft jar, libraries, assets and profile.
 *
 * This can continue to install an aborted or failed installation, and it can diagnose the installation if `options.diagnose` is set to `true`.
 *
 * @param version The resolved version to install
 * @param options Installation options
 * @throws InstallError when diagnose is true and there are issues found during installation
 */
export async function completeInstallation(
  version: ResolvedVersion,
  options: CompleteOptions = {},
): Promise<void> {
  let issue: InstallIssue = {}

  await installMinecraftJar(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue)
      return
    }
    throw e
  })

  const folder = MinecraftFolder.from(version.minecraftDirectory)
  const versionDir = folder.getVersionRoot(version.id)
  const profile = await readProfile(versionDir)
  if (profile) {
    const issue = await diagnoseProfile(profile, folder, options.side)
    if (issue) {
      if (options.diagnose) {
        throw new InstallError({
          profile,
        })
      }

      await installByProfile(profile, folder, { ...options, tracker: options.tracker })
    }
  }

  await installLibraries(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue)
      return
    }
    throw e
  })
  await installAssets(version, { ...options, tracker: options.tracker }).catch((e) => {
    if (options.diagnose && isInstallError(e)) {
      mergeInstallIssue(issue, e.issue)
      return
    }
    throw e
  })

  if (options.diagnose && Object.keys(issue).length > 0) {
    if (issue.libraries && issue.libraries.length > 0) {
      const optifines = [] as ResolvedLibrary[]
      const forges = [] as ResolvedLibrary[]
      const others = [] as ResolvedLibrary[]
      for (const l of issue.libraries) {
        if (l.groupId === 'optifine') {
          optifines.push(l)
        } else if (
          l.groupId === 'net.minecraftforge' &&
          l.artifactId === 'forge' &&
          (l.classifier === 'client' || !l.classifier)
        ) {
          forges.push(l)
        } else {
          others.push(l)
        }
      }
      if (others.length > 0) {
        issue.libraries = others
      }
      if (optifines.length > 0) {
        issue.optifine = optifines[0].version
      }
      if (forges.length > 0) {
        const header = getResolvedVersionHeader(version)
        if (header.forge && header.minecraft) {
          issue.forge = {
            minecraft: header.minecraft,
            version: header.forge,
          }
        }
      }
    }
    throw new InstallError(issue)
  }
}

export async function completeInstallationByError(
  version: ResolvedVersion,
  error: InstallError,
  options: CompleteOptions = {},
): Promise<void> {
  const issue = error.issue
  const folder = MinecraftFolder.from(version.minecraftDirectory)

  if (issue.jar) {
    await installMinecraftJar(version, { ...options, tracker: options.tracker })
  }

  if (issue.forge) {
    await installForge(
      {
        mcversion: issue.forge.minecraft,
        version: issue.forge.version,
      },
      folder,
      { ...options, tracker: options.tracker },
    )
  } else if (issue.profile) {
    await installByProfile(issue.profile, folder, { ...options, tracker: options.tracker })
  }

  if (issue.libraries && issue.libraries.length > 0) {
    await installResolvedLibraries(issue.libraries, folder, {
      ...options,
      tracker: options.tracker,
    })
  }

  if (issue.assetsIndex) {
    await installAssets(version, { ...options, tracker: options.tracker })
  } else if (issue.assets && issue.assets.length > 0) {
    await installResolvedAssets(issue.assets, folder, version.id, options)
  }
}
