import { GameOptionsState, Instance, InstanceOptionsServiceKey, InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { ModFile } from '@/util/mod'
import useSWRV from 'swrv'

export const kInstanceShaderPacks: InjectionKey<ReturnType<typeof useInstanceShaderPacks>> = Symbol('InstanceShaderPacks')

export function useInstanceShaderPacks(instance: Ref<Instance>, mods: Ref<ModFile[]>, gameOptions: Ref<GameOptionsState | undefined>) {
  const { link, scan } = useService(InstanceShaderPacksServiceKey)
  const { getIrisShaderOptions, editIrisShaderOptions, getShaderOptions, editShaderOptions } = useService(InstanceOptionsServiceKey)

  const linked = ref(false)
  const { refresh, refreshing } = useRefreshable(async () => {
    linked.value = await link(instance.value.path)

    if (!linked.value) {
      await scan(instance.value.path)
    }
  })
  const shaderMod = computed(() => {
    if (instance.value.runtime.optifine) {
      return {
        id: 'optifine',
        name: 'Optifine',
        version: instance.value.runtime.optifine,
        icon: 'image://builtin/optifine',
      }
    }
    const shader = mods.value.find(m => {
      const forge = m.resource.metadata.forge
      const fabric = m.resource.metadata.fabric
      if (forge) {
        // optifine in forge
        return forge.modid === 'optifine'
      } else if (fabric) {
        if (fabric instanceof Array) {
          // optifine fabric or iris
          if (fabric.some(f => f.id === 'optifabric' || f.id === 'iris')) return true
        } else {
          if (fabric.id === 'optifabric' || fabric.id === 'iris') return true
        }
      }
      return false
    })

    const normalzieFabricResource = (fabric: FabricModMetadata | FabricModMetadata[], icon?: string) => {
      if (fabric instanceof Array) {
        return fabric.map(f => ({
          id: f.id,
          name: f.name,
          version: f.version,
          icon,
        }))[0]
      } else {
        return {
          id: fabric.id,
          name: fabric.name,
          version: fabric.version,
          icon,
        }
      }
    }
    return shader?.resource.metadata.forge
      ? {
        id: shader.resource.metadata.forge.modid,
        name: shader.resource.metadata.forge.name,
        version: shader.resource.metadata.forge.version,
        icon: shader.icon,
      }
      : shader?.resource.metadata.fabric ? normalzieFabricResource(shader.resource.metadata.fabric, shader.icon) : undefined
  })

  const { data: shaderPackStatus, mutate } = useSWRV('/shader', async () => {
    console.log('update shader pack status')
    const mod = shaderMod.value
    if (mod?.id === 'optifine' || mod?.id === 'optifabric') {
      return ['optifine', gameOptions.value?.shaderPack] as const
    }
    if (mod?.id === 'iris') {
      const options = await getIrisShaderOptions(instance.value.path)
      return ['iris', options.shaderPack] as const
    }
  })

  watch([shaderMod, computed(() => gameOptions.value?.shaderPack)], () => {
    mutate()
  })

  const shaderPack = computed({
    get() {
      console.log(`get shader pack ${shaderPackStatus.value?.[1]}`)
      return shaderPackStatus.value?.[1]
    },
    set(v: string | undefined) {
      if (shaderPackStatus.value?.[0] === 'optifine') {
        editShaderOptions({
          instancePath: instance.value.path,
          shaderPack: v ?? '',
        })
      } else if (shaderPackStatus.value?.[0] === 'iris') {
        editIrisShaderOptions({
          instancePath: instance.value.path,
          shaderPack: v ?? '',
        }).then(() => mutate())
      }
    },
  })

  watch(instance, refresh, { immediate: true })

  return {
    linked,
    shaderMod,
    shaderPack,
    refresh,
    refreshing,
  }
}
