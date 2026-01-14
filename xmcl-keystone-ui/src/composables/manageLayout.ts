import { useLocalStorageCacheStringValue } from './cache'

export function useManageLayout() {
  const manageLayout = useLocalStorageCacheStringValue('manage_layout', 'classic' as 'classic' | 'modern')
  return manageLayout
}
