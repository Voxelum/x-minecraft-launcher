import { BuiltinImages } from '@/constant'
import { ModFile } from '@/util/mod'
import { ProjectFile } from '@/util/search'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { GameOptionsState, InstanceOptionsServiceKey, InstanceShaderPacksServiceKey, Resource, ResourceState, RuntimeVersions } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'
import { useState } from './syncableState'
import { ReactiveResourceState } from '@/util/ReactiveResourceState'

export const kInstanceShaderPacks: InjectionKey<ReturnType<typeof useInstanceShaderPacks>> = Symbol('InstanceShaderPacks')

export interface InstanceShaderFile extends ProjectFile {
  fileName: string

  size: number

  hash: string
}

export function useInstanceShaderPacks(instancePath: Ref<string>, runtime: Ref<RuntimeVersions>, mods: Ref<ModFile[]>, gameOptions: Ref<GameOptionsState | undefined>) {
  const { link, watch: watchShaderPacks } = useService(InstanceShaderPacksServiceKey)
  const { editOculusShaderOptions, getOculusShaderOptions, getIrisShaderOptions, editIrisShaderOptions, getShaderOptions, editShaderOptions } = useService(InstanceOptionsServiceKey)

  const { state, error, isValidating } = useState(() => instancePath.value ? watchShaderPacks(instancePath.value) : undefined, ReactiveResourceState)

  const shaderPacks = computed(() => state.value?.files.map(f => ({
    path: f.path,
    version: '',
    enabled: shaderPack.value === f.fileName,
    fileName: f.fileName,
    size: f.size,
    hash: f.hash,
    modrinth: f.metadata.modrinth,
    curseforge: f.metadata.curseforge,
  } as InstanceShaderFile)) || [])
  const linked = ref(false)
  const { refresh: refreshLinkedStatus, refreshing } = useRefreshable<string>(async (path) => {
    if (!path) return
    linked.value = await link(path)
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
      if (!m.enabled) return false
      const forge = m.forge
      const fabric = m.fabric
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
    return shader?.forge
      ? {
        id: shader.forge.modid,
        name: shader.forge.name,
        version: shader.forge.version,
        icon: shader.icon,
      }
      : shader?.fabric ? normalzieFabricResource(shader.fabric, shader.icon) : undefined
  })
  const shaderPackPath = computed(() => {
    console.log('get shader pack path')
    return gameOptions.value?.shaderPack
  })

  const shaderPackStatus = ref(undefined as [string, string | undefined] | undefined)
  const { refresh: mutateShaderPackOptions } = useRefreshable(async () => {
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

  const debouncedMutateShaderPackOptions = debounce(mutateShaderPackOptions, 300)
  watch([shaderMod, shaderPackPath], () => debouncedMutateShaderPackOptions())

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
        }).then(() => mutateShaderPackOptions())
      } else if (shaderPackStatus.value?.[0] === 'oculus') {
        editOculusShaderOptions({
          instancePath: instancePath.value,
          shaderPack: v ?? '',
        }).then(() => mutateShaderPackOptions())
      }
    },
  })

  function effect() {
  }

  watch(instancePath, refreshLinkedStatus, { immediate: true })

  return {
    linked,
    shaderMod,
    shaderPack,
    shaderPacks,
    refresh: refreshLinkedStatus,
    refreshing: computed(() => refreshing.value || isValidating.value),
    error,
    effect,
  }
}
