import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

export function useLaunch() {
    const { state, services } = useStore();
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
        launch: services.LaunchService.launch,
    };
}
