import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

export function useBackgroundImage() {
    const { state, getters } = useStore();
    const blur = computed(
        () => getters.selectedInstance.blur || state.setting.defaultBlur,
    );
    const backgroundImage = computed(
        () => getters.selectedInstance.image
            || state.setting.defaultBackgroundImage,
    );
    return {
        blur,
        backgroundImage,
    };
}
