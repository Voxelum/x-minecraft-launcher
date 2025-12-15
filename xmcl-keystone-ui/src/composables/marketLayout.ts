import { useLocalStorageCacheStringValue } from './cache'

export function useMarketLayout() {
  const marketLayout = useLocalStorageCacheStringValue('market_layout', 'modern' as 'classic' | 'modern')
  return marketLayout
}
