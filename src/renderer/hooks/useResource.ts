import { computed } from '@vue/composition-api'
import { useServiceOnly } from './useService'
import { useStore } from './useStore'

export function useResourceOperation() {
  const { parseAndImportResourceIfAbsent, removeResource } = useServiceOnly('ResourceService', 'parseAndImportResourceIfAbsent', 'removeResource')
  return {
    removeResource,
    importResource: parseAndImportResourceIfAbsent
  }
}

export function useModResource() {
  const { state } = useStore()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resource.mods)
  }
}

export function useResourcePackResource() {
  const { state } = useStore()
  return {
    ...useResourceOperation(),
    resources: computed(() => state.resource.resourcepacks)
  }
}

export function useCurseforgeImport() {
  return useServiceOnly('InstanceCurseforgeIOService', 'importCurseforgeModpack')
}
