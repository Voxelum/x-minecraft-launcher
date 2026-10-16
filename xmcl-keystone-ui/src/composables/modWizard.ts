import { BuiltinImages } from '@/constant'
import { PromiseSignal, createPromiseSignal } from '@xmcl/runtime-api'
import { useSimpleDialog } from './dialog'
import { notNullish } from '@vueuse/core'
import { useInstanceModLoaderDefault } from './instanceModLoaderDefault'
import { ProjectFile } from '@/util/search'
import { ModFile } from '@/util/mod'
import { isNoModLoader } from '@/util/isNoModloader'
import { injection } from '@/util/inject'
import { kInstance } from './instance'
import { RuntimeVersions } from '@xmcl/instance'

// Install modloader wizard
interface WizardOptions {
  loaders: string[]
  instance: string
  runtime: RuntimeVersions
  gameVersions?: string[]
}

export function useModWizard() {
  const { runtime, path } = injection(kInstance)
  const noModloaders = computed(() => isNoModLoader(runtime.value))
  const { model, show: _showInstallModloadersWizard, target } = useSimpleDialog<WizardOptions>(() => { })

  const installModRuntime = useInstanceModLoaderDefault()

  let signal: PromiseSignal<boolean> | undefined
  function showInstallModloadersWizard(o: WizardOptions) {
    if (o.loaders.length === 1) {
      return installModRuntime(o.instance, o.runtime, o.loaders, o.gameVersions).catch(() => false)
    }
    signal = createPromiseSignal()
    _showInstallModloadersWizard(o)
    return signal.promise
  }

  watch(model, (v) => {
    if (!v) {
      signal?.resolve(false)
    }
  })

  const wizardError = ref(undefined as Error | { loader: string; minecraft: string } | undefined)
  const wizardModItems = computed(() => {
    if (!target.value) return []
    const { loaders, instance, runtime, gameVersions } = target.value
    const onSelect = async (loader: string) => {
      const result = await installModRuntime(instance, runtime, [loader], gameVersions).catch((v) => v)
      if (typeof result === 'boolean') {
        signal?.resolve(result)
        if (result) {
          model.value = false
        } else {
          wizardError.value = {
            loader,
            minecraft: runtime.minecraft,
          }
        }
      } else {
        signal?.resolve(false)
        wizardError.value = result
      }
    }
    return loaders.map((v) => {
      if (v === 'forge') {
        return {
          title: 'Forge',
          icon: BuiltinImages.forge,
          url: 'https://files.minecraftforge.net/',
          onSelect: () => { onSelect('forge') },
        }
      }
      if (v === 'fabric') {
        return {
          title: 'Fabric',
          icon: BuiltinImages.fabric,
          url: 'https://fabricmc.net/use/',
          onSelect: () => { onSelect('fabric') },
        }
      }
      if (v === 'quilt') {
        return {
          title: 'Quilt',
          icon: BuiltinImages.quilt,
          url: 'https://quiltmc.org/',
          onSelect: () => { onSelect('quilt') },
        }
      }
      if (v === 'neoforge') {
        return {
          title: 'NeoForge',
          icon: BuiltinImages.neoForged,
          url: 'https://neoforge.org/',
          onSelect: () => { onSelect('neoforge') },
        }
      }
      return undefined
    }).filter(notNullish)
  })

  async function onInstallModRuntime(...args: Parameters<typeof installModRuntime>) {
    const currentRuntime = args[1] || runtime.value
    const loaders = args[2]
    const gameVersions = args[3]
    const currentMc = currentRuntime.minecraft
    const needsGameVersionAdapt = Boolean(gameVersions && gameVersions.length > 0 && !gameVersions.includes(currentMc))
    const hasCompatibleLoader = loaders.some(l => {
      if (l === 'fabric' && (currentRuntime.fabricLoader || currentRuntime.quiltLoader)) return true
      if (l === 'forge' && currentRuntime.forge) return true
      if (l === 'neoforge' && currentRuntime.neoForged) return true
      if (l === 'quilt' && currentRuntime.quiltLoader) return true
      return false
    })

    if (noModloaders.value || !hasCompatibleLoader || needsGameVersionAdapt) {
      return await showInstallModloadersWizard({
        loaders,
        instance: args[0],
        runtime: currentRuntime,
        gameVersions,
      })
    }
    return true
  }

  async function wizardHandleOnEnable(f: ProjectFile, _path?: string) {
    const modFile = f as ModFile
    const modLoaders = modFile.modLoaders || []
    const gameVersions = (modFile as any).gameVersions ||
      (modFile.curseforge as any)?.gameVersions ||
      (modFile.provideRuntime?.minecraft ? [modFile.provideRuntime.minecraft] : undefined)

    const currentRuntime = runtime.value
    const currentMc = currentRuntime.minecraft
    const needsGameVersionAdapt = Boolean(gameVersions && gameVersions.length > 0 && !gameVersions.includes(currentMc))
    const hasCompatibleLoader = modLoaders.length === 0 || modLoaders.some(l => {
      if (l === 'fabric' && (currentRuntime.fabricLoader || currentRuntime.quiltLoader)) return true
      if (l === 'forge' && currentRuntime.forge) return true
      if (l === 'neoforge' && currentRuntime.neoForged) return true
      if (l === 'quilt' && currentRuntime.quiltLoader) return true
      return false
    })

    if (noModloaders.value || !hasCompatibleLoader || needsGameVersionAdapt) {
      const success = await showInstallModloadersWizard({
        loaders: modLoaders,
        instance: _path || path.value,
        runtime: currentRuntime,
        gameVersions,
      })
      if (!success) {
        return true
      }
    }
  }

  return {
    wizardModel: model,
    wizardModItems,
    wizardError,
    onInstallModRuntime,
    wizardHandleOnEnable,
  }
}
