import { useService } from '@/composables'
import { InstanceSave, InstanceSavesServiceKey, Saves } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useState } from './syncableState'
import { ProjectFile } from '@/util/search'
import useSWRV from 'swrv'
import { BuiltinImages } from '@/constant'
import { notNullish } from '@vueuse/core'

export const kInstanceSave: InjectionKey<ReturnType<typeof useInstanceSaves>> = Symbol('InstanceSave')

export interface InstanceSaveFile extends ProjectFile, InstanceSave {
}

export function useInstanceSaves(instancePath: Ref<string>) {
  const { watch, getInstanceSaves, getSharedSaves, shareSave } = useService(InstanceSavesServiceKey)
  const { state, isValidating, error, revalidate } = useState(() => instancePath.value ? watch(instancePath.value) : undefined, Saves)

  const { isSaveLinked, importSave, deleteSave } = useService(InstanceSavesServiceKey)
  const { data: isInstanceLinked, isValidating: isInstanceLinkValidating } = useSWRV(instancePath, isSaveLinked)
  const { data: sharedSavesData, mutate: revalidateSharedSave } = useSWRV(computed(() => `${instancePath.value}:${isInstanceLinked.value}`), getSharedSaves)

  const saves = computed(() => {
    const saves = state.value?.saves || []
    const result: InstanceSaveFile[] = saves.map(s => ({
      ...s,
      icon: s.icon || BuiltinImages.unknownServer,
      version: '',
      enabled: true,
    }))
    return result
  })

  const sharedSaves = computed(() => {
    if (isInstanceLinked.value) return []
    const local = saves.value.map(s => s.linkTo).filter(notNullish)
    const all = sharedSavesData.value || []
    const result: InstanceSaveFile[] = all.filter(s => !local.includes(s.path)).map(s => ({
      ...s,
      icon: s.icon || BuiltinImages.unknownServer,
      version: '',
      enabled: false,
    }))
    return result
  })

  const enableSave = async (save: InstanceSaveFile) => {
    if (isInstanceLinked.value) {
      return
    }
    await importSave({ instancePath: instancePath.value, path: save.path })
    revalidate()
  }

  const disableSave = async (save: InstanceSaveFile) => {
    if (isInstanceLinked.value) {
      return
    }
    if (save.linkTo) {
      await deleteSave({ instancePath: instancePath.value, saveName: save.name })
    } else {
      await shareSave({ instancePath: instancePath.value, saveName: save.name })
    }
    revalidate()
    revalidateSharedSave()
  }

  const _deleteSave = async (save: InstanceSaveFile) => {
    const isShared = !save.enabled

    if (isShared) {
      await deleteSave({ saveName: save.name })
      revalidateSharedSave()
    } else {
      await deleteSave({ instancePath: instancePath.value, saveName: save.name })
      revalidate()
    }
  }

  return {
    revalidate,
    saves,
    sharedSaves,
    isValidating,
    error,
    isInstanceLinked,
    isInstanceLinkValidating,

    enableSave,
    disableSave,
    deleteSave: _deleteSave,
  }
}
