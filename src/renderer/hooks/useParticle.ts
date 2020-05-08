import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from './useCache';

export enum ParticleMode {
    PUSH = 'push',
    REMOVE = 'remove',
    REPULSE = 'repulse',
    BUBBLE = 'bubble',
}

export function useParticle() {
    const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.REPULSE);
    const showParticle = useLocalStorageCacheBool('showParticle', false);
    return {
        showParticle,
        particleMode,
    };
}
