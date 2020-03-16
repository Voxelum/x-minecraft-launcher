import { computed } from '@vue/composition-api';
import { useStore } from './useStore';
import { useService, useServiceOnly } from './useService';

export function useLaunch() {
    const { state } = useStore();
    const status = computed(() => state.launch.status);
    const errorType = computed(() => state.launch.errorType);
    const errors = computed(() => state.launch.errors.map((e) => {
        if (e instanceof Error) {
            return e.stack;
        }
        return JSON.stringify(e);
    }).join('\n'));
    return {
        status,
        errorType,
        errors,
        ...useServiceOnly('LaunchService', 'launch'),
    };
}
