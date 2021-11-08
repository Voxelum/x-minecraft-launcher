import { useService } from './useService'
import { ImportServiceKey } from '/@shared/services/ImportService'
import { ResourceServiceKey } from '/@shared/services/ResourceService'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { resolveFiles, resolveFile } = useService(ResourceServiceKey)
  return {
    importFile,
    resolveFile,
    resolveFiles,
  } as const
}
