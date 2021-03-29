import { computed } from '@vue/composition-api'
import { useServiceOnly } from './useService'
import { useStore } from './useStore'
import { InstanceCurseforgeIOServiceKey } from '/@shared/services/InstanceCurseforgeIOServic'
import { ResourceServiceKey } from '/@shared/services/ResourceService'

export function useResourceOperation() {
  const { importFile, removeResource } = useServiceOnly(ResourceServiceKey, 'importFile', 'removeResource')
  return {
    removeResource,
    importResource: importFile,
  }
}

export function useSaveResource() {
  const { state } = useStore()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resource.saves),
  }
}

export function useModResource() {
  const { state } = useStore()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resource.mods),
  }
}

export function useResourcePackResource() {
  const { state } = useStore()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resource.resourcepacks),
  }
}

export function useCurseforgeImport() {
  return useServiceOnly(InstanceCurseforgeIOServiceKey, 'importCurseforgeModpack')
}
