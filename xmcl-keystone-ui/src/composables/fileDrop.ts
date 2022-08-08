import { useService } from './service'
import { ImportServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { resolveResource } = useService(ResourceServiceKey)
  return {
    importFile,
    resolveFile: resolveResource,
  } as const
}
