import { useService } from './service'
import { ImportServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { resolveResources } = useService(ResourceServiceKey)
  return {
    importFile,
    resolveFile: resolveResources,
  } as const
}
