import { computed } from '@vue/composition-api';
import { useStore } from './useStore';

export function useBackgroundImage() {
    const { state, getters } = useStore();
    const blur = computed(
        () => getters.instance.blur || state.setting.defaultBlur,
    );
    const backgroundImage = computed(
        () => getters.instance.image
            || state.setting.defaultBackgroundImage,
    );
    return {
        blur,
        backgroundImage,
    };
}
