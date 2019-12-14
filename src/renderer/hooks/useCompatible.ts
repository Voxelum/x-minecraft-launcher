import { Ref, computed } from '@vue/composition-api';
import { isCompatible } from 'universal/utils';
import { useStore } from './useStore';

export function useCompatible(acceptedRange: Ref<string>, mcversion: Ref<string> = computed(() => useStore().getters.selectedInstance.runtime.minecraft)) {
    const compatible = computed(() => isCompatible(acceptedRange.value, mcversion.value));
    return { compatible };
}

export function useIsCompatible() {
    return { isCompatible };
}
