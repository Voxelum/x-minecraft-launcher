import { BuiltinImages } from '@/constant'
import { PromiseSignal, RuntimeVersions, createPromiseSignal } from '@xmcl/runtime-api'
import { useSimpleDialog } from './dialog'
import { notNullish } from '@vueuse/core'
import { useInstanceModLoaderDefault } from './instanceModLoaderDefault'
import { ProjectFile } from '@/util/search'
import { ModFile } from '@/util/mod'
import { isNoModLoader } from '@/util/isNoModloader'
import { injection } from '@/util/inject'
import { kInstance } from './instance'

// Install modloader wizard
interface WizardOptions {
  loaders: string[]
  instance: string
  runtime: RuntimeVersions
}

export function useModWizard() {
  const { runtime, path } = injection(kInstance)
  const noModloaders = computed(() => isNoModLoader(runtime.value))
  const { model, show: _showInstallModloadersWizard, target } = useSimpleDialog<WizardOptions>(() => { })

  const installModRuntime = useInstanceModLoaderDefault()

  async function onInstallModRuntime(...args: Parameters<typeof installModRuntime>) {
    if (noModloaders.value) {
      return await showInstallModloadersWizard({
        loaders: args[2],
        instance: args[0],
        runtime: args[1],
      })
    }
    return true
  }

  let signal: PromiseSignal<boolean> | undefined
  function showInstallModloadersWizard(o: WizardOptions) {
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
    const { loaders, instance, runtime } = target.value
    const onSelect = async (loader: string) => {
      const result = await installModRuntime(instance, runtime, [loader]).catch((v) => v)
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

  async function wizardHandleOnEnable(f: ProjectFile, _path?: string) {
    if (noModloaders.value) {
      const success = await showInstallModloadersWizard({
        loaders: (f as ModFile).modLoaders,
        instance: _path || path.value,
        runtime: runtime.value,
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
