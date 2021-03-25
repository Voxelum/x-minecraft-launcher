import { useService } from './useService'
import { ImportServiceKey } from '/@shared/services/ImportService'
import { ResourceServiceKey } from '/@shared/services/ResourceService'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { parseFile, parseFiles } = useService(ResourceServiceKey)
  return {
    importFile,
    parseFile,
    parseFiles,
  } as const
}
