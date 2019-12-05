import { useStore } from "./useStore";
import { computed } from "@vue/composition-api";

export function useJava() {
    const { state, getters, services } = useStore();
    const all = computed(() => state.java.all);
    const defaultJava = computed(() => state.java.all[state.java.default]);
    const missing = computed(() => getters.missingJava);

    return {
        all,
        default: defaultJava,
        add: services.JavaService.resolveJava,
        installDefault: services.JavaService.installJava,
        refreshLocalJava: services.JavaService.refreshLocalJava,
        missing,
    }
}
