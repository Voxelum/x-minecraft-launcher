import { useService } from './useService'
import { ImportServiceKey } from '@xmcl/runtime-api'
import { ResourceServiceKey } from '@xmcl/runtime-api'

export function useFileDrop() {
  const { importFile } = useService(ImportServiceKey)
  const { resolveFiles, resolveFile } = useService(ResourceServiceKey)
  return {
    importFile,
    resolveFile,
    resolveFiles,
  } as const
}
