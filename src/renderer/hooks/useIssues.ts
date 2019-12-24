import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

export function useIssues() {
    const { getters } = useStore();
    const issues = computed(() => getters.issues);
    const refreshing = computed(() => getters.busy('diagnose'));

    return {
        issues,
        refreshing,
    };
}
