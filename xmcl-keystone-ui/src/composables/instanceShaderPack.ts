import { BuiltinImages } from '@/constant'
import { ModFile } from '@/util/mod'
import { ProjectFile } from '@/util/search'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { GameOptionsState, InstanceOptionsServiceKey, InstanceShaderPacksServiceKey, Resource, RuntimeVersions } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export const kInstanceShaderPacks: InjectionKey<ReturnType<typeof useInstanceShaderPacks>> = Symbol('InstanceShaderPacks')

export interface InstanceShaderFile extends ProjectFile {
  /**
   * Backed resource
   */
  resource: Resource
}

export function useInstanceShaderPacks(instancePath: Ref<string>, runtime: Ref<RuntimeVersions>, mods: Ref<ModFile[]>, gameOptions: Ref<GameOptionsState | undefined>) {
  const { link, scan } = useService(InstanceShaderPacksServiceKey)
  const { editOculusShaderOptions, getOculusShaderOptions, getIrisShaderOptions, editIrisShaderOptions, getShaderOptions, editShaderOptions } = useService(InstanceOptionsServiceKey)

  const linked = ref(false)
  const { refresh, refreshing } = useRefreshable<string>(async (path) => {
    if (!path) return
    linked.value = await link(path)

    if (!linked.value) {
      await scan(path)
    }
  })
  const shaderMod = computed(() => {
    if (runtime.value.optifine) {
      return {
        id: 'optifine',
        name: 'Optifine',
        version: runtime.value.optifine,
        icon: BuiltinImages.optifine,
      }
    }
    const shader = mods.value.find(m => {
      const forge = m.resource.metadata.forge
      const fabric = m.resource.metadata.fabric
      if (forge) {
        // optifine in forge
        if (forge.modid === 'optifine') {
          return true
        }
        return forge.modid === 'oculus'
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
  const shaderPackPath = computed(() => {
    console.log('get shader pack path')
    return gameOptions.value?.shaderPack
  })

  const shaderPackStatus = ref(undefined as [string, string | undefined] | undefined)
  const { refresh: mutate } = useRefreshable(async () => {
    const mod = shaderMod.value
    const inst = instancePath.value
    if (mod?.id === 'optifine' || mod?.id === 'optifabric') {
      shaderPackStatus.value = ['optifine', gameOptions.value?.shaderPack] as const
    } else if (mod?.id === 'iris') {
      const options = await getIrisShaderOptions(inst)
      if (inst === instancePath.value) {
        shaderPackStatus.value = ['iris', options.shaderPack] as const
      } else {
        shaderPackStatus.value = undefined
      }
    } else if (mod?.id === 'oculus') {
      const options = await getOculusShaderOptions(inst)
      if (inst === instancePath.value) {
        shaderPackStatus.value = ['oculus', options.shaderPack] as const
      } else {
        shaderPackStatus.value = undefined
      }
    } else {
      shaderPackStatus.value = undefined
    }
  })

  const debounced = debounce(mutate, 300)

  watch([shaderMod, shaderPackPath], () => debounced())

  const shaderPack = computed({
    get() {
      console.log(`get shader pack ${shaderPackStatus.value?.[1]}`)
      return shaderPackStatus.value?.[1]
    },
    set(v: string | undefined) {
      if (shaderPackStatus.value?.[0] === 'optifine') {
        editShaderOptions({
          instancePath: instancePath.value,
          shaderPack: v ?? '',
        })
      } else if (shaderPackStatus.value?.[0] === 'iris') {
        editIrisShaderOptions({
          instancePath: instancePath.value,
          shaderPack: v ?? '',
        }).then(() => mutate())
      } else if (shaderPackStatus.value?.[0] === 'oculus') {
        editOculusShaderOptions({
          instancePath: instancePath.value,
          shaderPack: v ?? '',
        }).then(() => mutate())
      }
    },
  })

  watch(instancePath, refresh, { immediate: true })

  return {
    linked,
    shaderMod,
    shaderPack,
    refresh,
    refreshing,
  }
}
