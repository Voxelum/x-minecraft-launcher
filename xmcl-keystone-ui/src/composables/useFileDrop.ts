import { useService } from './useService'
import { ImportServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { resolveResource, resolveResources } = useService(ResourceServiceKey)
  return {
    importFile,
    resolveFile: resolveResource,
    resolveFiles: resolveResources,
  } as const
}
