import { computed } from '@vue/composition-api'
import { useService, useServiceOnly } from './service'
import { ModpackServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'

export function useResourceOperation() {
  const { importResource, removeResource } = useServiceOnly(ResourceServiceKey, 'importResource', 'removeResource')
  return {
    removeResource,
    importResource,
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
