import { injection } from '@/util/inject'
import { getExpectVersion } from '@xmcl/runtime-api'
import { kInstanceFiles } from './instanceFiles'
import { LaunchMenuItem } from './launchButton'
import { kInstanceVersionInstall } from './instanceVersionInstall'

export const enum LaunchMenuItemIssue {
  None = 0,
  MissingVersion = 1 << 0,
  MissingJava = 1 << 1,
  BadProfile = 1 << 2,
  CorruptedJar = 1 << 3,
  CorruptedLibraries = 1 << 4,
  MissingLibraries = 1 << 5,
  CorruptedAssets = 1 << 6,
  CorruptedAssetsIndex = 1 << 7,
  BadForge = 1 << 8,
  BadOptifine = 1 << 9,
  UnzipFileNotFound = 1 << 10,
  PendingFiles = 1 << 11,
}

export function useInstanceLaunchMenuItems() {
  const { t } = useI18n()
  const { instruction } = injection(kInstanceVersionInstall)
  const {
    instanceInstallStatus,
    resumeInstall,
    isResumingInstall,
    isValidating,
    unzipFileNotFound,
  } = injection(kInstanceFiles)

  const issues = computed(() => {
    let flags = LaunchMenuItemIssue.None
    const currentInstruction = instruction.value

    if (unzipFileNotFound.value) {
      flags |= LaunchMenuItemIssue.UnzipFileNotFound
    } else if ((instanceInstallStatus.value?.pendingFileCount || 0) > 0) {
      flags |= LaunchMenuItemIssue.PendingFiles
    }

    if (!currentInstruction) return flags

    if (!currentInstruction.resolvedVersion) {
      flags |= LaunchMenuItemIssue.MissingVersion
    }
    if (currentInstruction.java) {
      flags |= LaunchMenuItemIssue.MissingJava
    }
    if (currentInstruction.profile) {
      flags |= LaunchMenuItemIssue.BadProfile
    }
    if (currentInstruction.jar) {
      flags |= LaunchMenuItemIssue.CorruptedJar
    }
    if (currentInstruction.libraries) {
      const libs = currentInstruction.libraries
      if (libs.some((lib) => lib.type === 'corrupted')) {
        flags |= LaunchMenuItemIssue.CorruptedLibraries
      } else {
        flags |= LaunchMenuItemIssue.MissingLibraries
      }
    }
    if (currentInstruction.assets) {
      flags |= LaunchMenuItemIssue.CorruptedAssets
    }
    if (currentInstruction.assetsIndex) {
      flags |= LaunchMenuItemIssue.CorruptedAssetsIndex
    }
    if (currentInstruction.forge) {
      flags |= LaunchMenuItemIssue.BadForge
    }
    if (currentInstruction.optifine) {
      flags |= LaunchMenuItemIssue.BadOptifine
    }

    return flags
  })

  const fixInstanceFileIssue = async () => {
    if (instanceInstallStatus.value && instanceInstallStatus.value.pendingFileCount > 0) {
      await resumeInstall(instanceInstallStatus.value.instance).catch((e) => {
        if (e.name === '') {
          throw e
        }
      })
    }
  }

  const loadingInstanceFiles = computed(
    () =>
      isValidating.value ||
      (instanceInstallStatus.value?.instance
        ? (isResumingInstall(instanceInstallStatus.value.instance) ?? false)
        : false),
  )

  const launchMenuItems = computed(() => {
    const items: LaunchMenuItem[] = []
    const flags = issues.value
    const currentInstruction = instruction.value

    if (flags & LaunchMenuItemIssue.UnzipFileNotFound) {
      items.push({
        title: t('diagnosis.unzipFileNotFound.title'),
        description: t('diagnosis.unzipFileNotFound.description', {
          file: unzipFileNotFound.value,
        }),
      })
    } else if (flags & LaunchMenuItemIssue.PendingFiles) {
      items.push({
        title: t('diagnosis.instanceFiles.title'),
        description: t('diagnosis.instanceFiles.description', {
          counts: instanceInstallStatus.value?.pendingFileCount,
        }),
      })
    }

    if (!currentInstruction) return items

    if (flags & LaunchMenuItemIssue.MissingVersion) {
      items.push({
        title: t('diagnosis.missingVersion.name', {
          version: getExpectVersion(currentInstruction.runtime),
        }),
        description: t('diagnosis.missingVersion.message'),
        noDisplay: true,
      })
    }
    if (flags & LaunchMenuItemIssue.MissingJava) {
      items.push({
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.BadProfile) {
      items.push({
        title: t('diagnosis.badInstall.name', { version: currentInstruction.resolvedVersion }),
        description: t('diagnosis.badInstall.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.CorruptedJar) {
      items.push({
        title: t('diagnosis.corruptedVersionJar.name', { version: currentInstruction.jar }),
        description: t('diagnosis.corruptedVersionJar.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.CorruptedLibraries) {
      const libs = currentInstruction.libraries!
      const options = { count: libs.length, name: libs[0].path }
      items.push({
        title: t('diagnosis.corruptedLibraries.name', options, libs.length),
        description: t('diagnosis.corruptedLibraries.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.MissingLibraries) {
      const libs = currentInstruction.libraries!
      const options = { count: libs.length, name: libs[0].path }
      items.push({
        title: t('diagnosis.missingLibraries.name', options, libs.length),
        description: t('diagnosis.missingLibraries.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.CorruptedAssets) {
      const assets = currentInstruction.assets!
      const count = assets.length
      const name = assets[0]?.name ?? ''
      items.push({
        title: t('diagnosis.corruptedAssets.name', { count, name }),
        description: t('diagnosis.corruptedAssets.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.CorruptedAssetsIndex) {
      items.push({
        title: t('diagnosis.corruptedAssetsIndex.name', {
          version: currentInstruction.assetsIndex!.id,
        }),
        description: t('diagnosis.corruptedAssetsIndex.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.BadForge) {
      items.push({
        title: t('diagnosis.badInstall.name'),
        description: t('diagnosis.badInstall.message'),
      })
    }
    if (flags & LaunchMenuItemIssue.BadOptifine) {
      items.push({
        title: t('diagnosis.badInstall.name'),
        description: t('diagnosis.badInstall.message'),
      })
    }

    return items
  })

  return {
    issues,
    fixInstanceFileIssue,
    loadingInstanceFiles,
    launchMenuItems,
  }
}
