import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from './useCache'

export enum ParticleMode {
  PUSH = 'push',
  REMOVE = 'remove',
  REPULSE = 'repulse',
  BUBBLE = 'bubble',
}

export function useParticle () {
  const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.PUSH)
  const showParticle = useLocalStorageCacheBool('showParticle', true)
  return {
    showParticle,
    particleMode,
  }
}

export function useBackgroundBlur () {
  const blurMainBody = useLocalStorageCacheBool('blurMainBody', true)
  return {
    blurMainBody,
  }
}
