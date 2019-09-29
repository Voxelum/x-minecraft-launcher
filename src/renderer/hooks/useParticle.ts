import useStore from "./useStore";
import { computed } from "@vue/composition-api";

export default function useParticle() {
    const { state, commit } = useStore();
    const showParticle = computed({
        get: () => state.setting.showParticle,
        set: v => commit('showParticle', v),
    });
    const particleMode = computed({
        get: () => state.setting.particleMode,
        set: v => commit('particleMode', v),
    });
    return {
        showParticle,
        particleMode,
    }
}
