import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { useInstanceBase } from './instance'
import { useService } from '/@/composables'

export function useInstanceSaves() {
  const { path } = useInstanceBase()
  const { state, cloneSave, deleteSave, exportSave, readAllInstancesSaves, importSave, mountInstanceSaves } = useService(InstanceSavesServiceKey)
  const refresh = () => mountInstanceSaves(path.value)
  return {
    refresh,
    cloneSave: (options: CloneSaveOptions) => cloneSave(options).finally(refresh),
    deleteSave: (options: DeleteSaveOptions) => deleteSave(options).finally(refresh),
    exportSave,
    readAllInstancesSaves,
    importSave: (options: ImportSaveOptions) => importSave(options).finally(refresh),
    saves: computed(() => state.saves),
  }
}
