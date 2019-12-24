import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

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
        openJavaSite: () => services.BaseService.openInBrowser('https://www.java.com/download/'),
    };
}
