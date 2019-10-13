import { ForgeResource } from "universal/store/modules/resource";
import { computed, onMounted, ref } from "@vue/composition-api";
import { isCompatible } from 'universal/utils/versions';
import { useStore } from "./useStore";
import unknownPack from '@/assets/unknown_pack.png';

export function useForgeModResource(resource: ForgeResource) {
    const { getters, dispatch } = useStore();
    const metadata = computed(() => resource.metadata[0]);
    const icon = ref(unknownPack);
    const acceptedRange = computed(() => {
        if (metadata.value.acceptedMinecraftVersions) {
            return metadata.value.acceptedMinecraftVersions;
        }
        if (metadata.value.mcversion) {
            const mcversion = metadata.value.mcversion;
            if (/^\[.+\]$/.test(mcversion)) {
                return mcversion;
            }
            return `[${mcversion}]`;
        }
        return '[*]';
    });
    const compatible = computed(() => {
        try {
            return isCompatible(acceptedRange.value, getters.selectedProfile.version.minecraft);
        } catch (e) {
            console.error(metadata.value.modid);
            console.error(e);
            return false;
        }
    });
    onMounted(() => {
        readLogo();
    });

    function readLogo() {
        if ('missing' in resource) {
            icon.value = unknownPack;
        } else {
            dispatch('readForgeLogo', resource.hash).then((i) => {
                if (typeof i === 'string' && i !== '') {
                    icon.value = `data:image/png;base64, ${i}`;
                } else {
                    icon.value = unknownPack;
                }
            });
        }
    }
    return {
        icon,
        metadata,
        acceptedRange,
        compatible,
    }
}