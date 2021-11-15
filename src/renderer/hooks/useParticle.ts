import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from './useCache'


export function useParticle() {
  const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.PUSH)
  return {
    particleMode,
  }
}
