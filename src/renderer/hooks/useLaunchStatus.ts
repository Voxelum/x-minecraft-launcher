import { computed, reactive, toRef, toRefs, onMounted } from '@vue/composition-api';
import { useStore } from './useStore';
import { useService, useServiceOnly } from './useService';

export function useLaunchEvent() {

}

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

export function useLaunchPreview() {
    const { generateArguments } = useService('LaunchService');
    const data = reactive({
        preview: [] as string[],
    });
    const wrapIfSpace = (s: string) => (s.indexOf(' ') !== -1 ? `"${s}"` : s);
    const refresh = () => generateArguments().then((args) => { data.preview = args; });
    const command = computed(() => data.preview.map(wrapIfSpace).join(' '));
    return {
        command,
        ...toRefs(data),
        refresh,
    };
}
