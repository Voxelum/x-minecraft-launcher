import { useStore } from "./useStore";
import { computed } from "@vue/composition-api";

export function useLaunch() {
    const { state, dispatch } = useStore();
    const status = computed(() => { return state.launch.status; });
    const errorType = computed(() => { return state.launch.errorType; });
    const errors = computed(() => {
        return state.launch.errors.map((e) => {
            if (e instanceof Error) {
                return e.stack;
            }
            return JSON.stringify(e);
        }).join('\n');
    });
    function launch() {
        return dispatch('launch');
    }
    function quit() {
        return dispatch('quit');
    }
    return {
        status,
        errorType,
        errors,
        launch,
        quit,
    }
}