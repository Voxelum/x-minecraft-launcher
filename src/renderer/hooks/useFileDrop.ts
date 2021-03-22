import { useService } from './useService'

export function useFileDrop() {
  const { importFile, readFileMetadata, readFilesMetadata } = useService('IOService')
  return {
    importFile,
    readFileMetadata,
    readFilesMetadata
  } as const
}
