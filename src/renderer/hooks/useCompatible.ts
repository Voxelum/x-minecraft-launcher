import { Ref, computed } from '@vue/composition-api';
import { isCompatible } from 'universal/utils';
import { useStore } from './useStore';

export function useCompatible(acceptedRange: Ref<string>, version: Ref<string> = computed(() => useStore().getters.instance.runtime.minecraft)) {
    const compatible = computed(() => (acceptedRange.value !== 'unknown' ? isCompatible(acceptedRange.value, version.value) : 'unknown'));
    return { compatible };
}

export function useCompatibleWithLoader(acceptedRange: Ref<string>, loaderRange: Ref<string>, mcVersion: Ref<string> = computed(() => useStore().getters.instance.runtime.minecraft)) {
    // eslint-disable-next-line no-nested-ternary
    const compatible = computed(() => (acceptedRange.value !== 'unknown'
        ? isCompatible(acceptedRange.value, mcVersion.value)
        : loaderRange.value !== 'unknown'
            ? isCompatible(loaderRange.value, mcVersion.value.substring(2))
            : 'unknown'));
    return { compatible };
}

export function useIsCompatible() {
    return { isCompatible };
}
