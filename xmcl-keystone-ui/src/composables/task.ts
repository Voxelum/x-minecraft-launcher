import { injection } from '@/util/inject'
import { TaskState, Tasks } from '@xmcl/runtime-api'
import { Ref, computed } from 'vue'
import { kTaskManager } from './taskManager'

export function useTaskCount() {
  const { tasks } = inject(kTaskManager, {
    tasks: { value: [] as Tasks[] } as any as Ref<Tasks[]>,
  } as any)
  const count = computed(
    () => tasks.value.filter((t: Tasks) => t.state === TaskState.Running).length,
  )
  return { count }
}

export interface LocalizedTask {
  title: string
  subtitle: string
}

/**
 * Provides a function that returns localized title and subtitle for a task
 * Uses explicit type matching with literal keys for type safety
 */
export function useLocalizedTaskFunc() {
  const { t } = useI18n()

  const localizeTask = (task: Tasks): LocalizedTask => {
    // Install Forge Task
    if (task.type === 'installForge') {
      const title = t('installForge.name') + ' ' + task.version
      let subtitle = ''
      if (task.substate.type === 'forge.installer') {
        subtitle = t('installForge.downloadInstaller')
      } else if (task.substate.type === 'libraries') {
        subtitle = t('installLibraries.name')
      } else if (task.substate.type === 'postprocess') {
        subtitle = t('installForge.postProcessing')
      }
      return { title, subtitle }
    }

    // Install NeoForge Task
    if (task.type === 'installNeoForge') {
      const title = t('installForge.name') + ' ' + task.version
      let subtitle = ''
      if (task.substate.type === 'forge.installer') {
        subtitle = t('installForge.downloadInstaller')
      } else if (task.substate.type === 'libraries') {
        subtitle = t('installLibraries.name')
      } else if (task.substate.type === 'postprocess') {
        subtitle = t('installForge.postProcessing')
      }
      return { title, subtitle }
    }

    // Install Assets Task
    if (task.type === 'installAssets') {
      const title = t('installAssets.name')
      let subtitle = ''
      if (task.substate.type === 'assets.assets') {
        subtitle = t('installAssets.asset', { count: task.substate.count ?? 0 })
      } else if (task.substate.type === 'assets.assetIndex') {
        subtitle = t('installAssets.assetIndex')
      } else if (task.substate.type === 'assets.logConfig') {
        subtitle = ''
      }
      return { title, subtitle }
    }

    // Install Libraries Task
    if (task.type === 'installLibraries') {
      const title = t('installLibraries.name')
      const subtitle = t('installLibraries.library')
      return { title, subtitle }
    }

    // Install Minecraft Version Task
    if (task.type === 'installVersion') {
      const title = t('installVersion.name', { version: task.version })
      let subtitle = ''
      if (task.substate.type === 'version.json') {
        subtitle = t('installVersion.json')
      } else if (task.substate.type === 'version.jar') {
        subtitle = t('installVersion.jar')
      }
      return { title, subtitle }
    }

    // Install Fabric Task
    if (task.type === 'installFabric') {
      const title = t('installFabric.name') + ' ' + task.loader
      return { title, subtitle: '' }
    }

    // Install Quilt Task
    if (task.type === 'installQuilt') {
      const title = t('installQuilt.name', { version: task.version })
      return { title, subtitle: '' }
    }

    // Install Optifine Task
    if (task.type === 'installOptifine') {
      const title = t('installOptifine.name') + ' ' + task.version
      let subtitle = ''
      if (task.substate.type === 'optifine.unpack') {
        subtitle = t('installOptifine.download')
      } else if (task.substate.type === 'libraries') {
        subtitle = t('installLibraries.name')
      }
      return { title, subtitle }
    }

    // Install LabyMod Task
    if (task.type === 'installLabyMod') {
      const title = t('installLabyMod.name') + ' ' + task.version
      const subtitle = t('installLibraries.name')
      return { title, subtitle }
    }

    // Reinstall Task
    if (task.type === 'reinstall') {
      const title = t('reinstall.name', { version: task.version })
      let subtitle = ''
      if (task.substate.type === 'version.json') {
        subtitle = t('installVersion.json')
      } else if (task.substate.type === 'version.jar') {
        subtitle = t('installVersion.jar')
      } else if (task.substate.type === 'libraries') {
        subtitle = t('installLibraries.name')
      } else if (task.substate.type === 'assets.assets') {
        subtitle = t('installAssets.name')
      } else if (task.substate.type === 'forge.installer') {
        subtitle = t('installForge.downloadInstaller')
      } else if (task.substate.type === 'postprocess') {
        subtitle = t('installForge.postProcessing')
      }
      return { title, subtitle }
    }

    // Install Profile Task
    if (task.type === 'installProfile') {
      const title = t('installProfile.name', { version: task.version })
      let subtitle = ''
      if (task.substate.type === 'forge.installer') {
        subtitle = t('installForge.downloadInstaller')
      } else if (task.substate.type === 'libraries') {
        subtitle = t('installLibraries.name')
      } else if (task.substate.type === 'postprocess') {
        subtitle = t('installForge.postProcessing')
      }
      return { title, subtitle }
    }

    // Install Java Task
    if (task.type === 'installJre') {
      const title = t('installJre.name')
      let subtitle = ''
      if (task.substate.type === 'zulu-java.download') {
        subtitle = t('installJre.download')
      } else if (task.substate.type === 'zulu-java.extract') {
        subtitle = t('installJre.decompress')
      } else if (task.substate.type === 'java-runtime.file') {
        subtitle = t('installJre.download')
      } else if (task.substate.type === 'java-runtime.json') {
        subtitle = ''
      }
      return { title, subtitle }
    }

    // Install Instance Task
    if (task.type === 'installInstance') {
      const title = t('installInstance.name')
      let subtitle = ''
      if (task.substate.type === 'install-instance.resolve') {
        subtitle = t('installInstance.resolve')
      } else if (task.substate.type === 'install-instance.download') {
        subtitle = t('installInstance.file', { file: task.substate.count ?? 0 })
      } else if (task.substate.type === 'install-instance.unzip') {
        subtitle = t('installInstance.unzip', { count: task.substate.count ?? 0 })
      } else if (task.substate.type === 'install-instance.link') {
        subtitle = t('installInstance.link', { count: task.substate.count ?? 0 })
      }
      return { title, subtitle }
    }

    // Export Modpack Task
    if (task.type === 'exportModpack') {
      const title = t('exportModpack.name') + ' ' + task.name
      return { title, subtitle: '' }
    }

    // Install Authlib Injector Task
    if (task.type === 'installAuthlibInjector') {
      const title = t('installAuthlibInjector')
      return { title, subtitle: '' }
    }

    // Download Mod Metadata DB Task
    if (task.type === 'downloadModMetadataDb') {
      const title = t('downloadModMetadataDb.name')
      return { title, subtitle: '' }
    }

    // Duplicate Instance Task
    if (task.type === 'duplicateInstance') {
      const title = t('duplicateInstance.name')
      return { title, subtitle: '' }
    }

    // Install Modrinth File Task
    if (task.type === 'installModrinthFile') {
      const title = t('installModrinthFile.name')
      const subtitle = task.filename
      return { title, subtitle }
    }

    // Install Curseforge File Task
    if (task.type === 'installCurseforgeFile') {
      const title = t('installCurseforgeFile')
      return { title, subtitle: '' }
    }

    // Download Update Task
    if (task.type === 'downloaUpdate') {
      const title = t('downloadUpdate.name', { version: task.version })
      return { title, subtitle: '' }
    }

    // Migrate Minecraft Task
    if (task.type === 'migrateMinecraft') {
      const title = t('migrateMinecraft.name')
      return { title, subtitle: '' }
    }

    // Fallback for unknown task types (exhaustive check)
    const _exhaustive: never = task
    return { title: '', subtitle: '' }
  }

  return localizeTask
}

export function useTasks(filter: (t: Tasks) => boolean) {
  const { tasks } = injection(kTaskManager)
  return computed(() => tasks.value.filter(filter))
}

export function useTask(finder: (i: Tasks) => boolean) {
  const proxy = injection(kTaskManager)

  const { tasks, cancel } = proxy

  const task = computed(() => tasks.value.find((i) => i.state === TaskState.Running && finder(i)))
  const status = computed(() => task.value?.state)
  const progress = computed(() => task.value?.progress?.progress ?? 0)
  const total = computed(() => task.value?.progress?.total ?? -1)

  return {
    task,
    progress,
    total,
    cancel: () => {
      if (task.value) {
        cancel(task.value)
      }
    },
    status,
  }
}
