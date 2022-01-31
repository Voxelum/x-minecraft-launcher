import { computed } from '@vue/composition-api'
import { useService, useServiceOnly } from './useService'
import { ModpackServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'

export function useResourceOperation() {
  const { importFile, removeResource } = useServiceOnly(ResourceServiceKey, 'importFile', 'removeResource')
  return {
    removeResource,
    importResource: importFile,
  }
}

export function useResourceService() {
  return useService(ResourceServiceKey)
}

export function useSaveResource() {
  const { state } = useResourceService()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.saves),
  }
}

export function useModResource() {
  const { state } = useResourceService()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.mods),
  }
}

export function useResourcePackResource() {
  const { state } = useResourceService()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resourcepacks),
  }
}

export function useCurseforgeImport() {
  return useServiceOnly(ModpackServiceKey, 'importCurseforgeModpack')
}
