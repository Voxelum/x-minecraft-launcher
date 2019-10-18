import { useStore } from "./useStore";
import { computed } from "@vue/composition-api";

export function useJava() {
    const { state, getters, dispatch } = useStore();
    const all = computed(() => state.java.all);
    const defaultJava = computed(() => state.java.all[state.java.default]);
    const missing = computed(() => getters.missingJava);

    function add(java: string) {
        dispatch('resolveJava', java);
    }

    return {
        all,
        default: defaultJava,
        add,
        missing,
    }
}
