import { toRefs, computed, ref, watch, onMounted, onUnmounted } from "@vue/composition-api";
import { ProfileModule } from "universal/store/modules/profile";
import { Data } from "@vue/composition-api/dist/component";
import { getExpectVersion } from "universal/utils/versions";
import { useStore } from "./useStore";

export default function useCurrentProfile() {
    const { state, getters } = useStore();

    const profile: ProfileModule.ServerOrModpack & Data = getters.selectedProfile as any;

    const refProfile = toRefs(profile);

    return {
        ...refProfile,
    };
}

export function useCurrentProfileVersion() {
    const { getters, dispatch } = useStore();

    const profile: ProfileModule.ServerOrModpack & Data = getters.selectedProfile as any;

    const refVersion = toRefs(profile.version);
    const folder = ref('');
    const id = computed(() => getExpectVersion(profile.version.minecraft,
        profile.version.forge,
        profile.version.liteloader));

    let watcher = () => { };

    dispatch('resolveVersion', profile.version)
        .then((f) => { folder.value = f; });

    onMounted(() => {
        watcher = watch(id, () => {
            dispatch('resolveVersion', profile.version)
                .then((f) => { folder.value = f; });
        });
    })
    onUnmounted(() => {
        watcher();
    });

    return {
        ...refVersion,
        id,
        folder,
    };
}

