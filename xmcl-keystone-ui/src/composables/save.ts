import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { useInstanceBase } from './instance'
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { kInstanceContext } from './instanceContext'

export function useInstanceSaves() {
  const {  } = injection(kInstanceContext)
  const { path } = useInstanceBase()
  const { cloneSave, deleteSave, exportSave, importSave } = useService(InstanceSavesServiceKey)
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
