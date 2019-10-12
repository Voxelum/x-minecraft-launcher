import { toRefs, computed, ref, watch, onMounted, onUnmounted } from "@vue/composition-api";
import { ProfileModule } from "universal/store/modules/profile";
import { Data } from "@vue/composition-api/dist/component";
import { getExpectVersion } from "universal/utils";
import { useStore } from "./useStore";

export function useCurrentProfile() {
    const { state, getters, dispatch } = useStore();
    const profile: ProfileModule.ServerAndModpack & Data = getters.selectedProfile as any;

    const maxMemory = computed(() => profile.maxMemory);
    const minMemory = computed(() => profile.minMemory);

    const isServer = computed(() => profile.type === 'server');
    const refreshing = computed(() => getters.refreshing);

    /**
     * Edit current profile
     */
    function edit(option: Partial<ProfileModule.ServerAndModpack>) {
        dispatch('editProfile', option);
    }
    function exportTo(destination: string, type: 'full' | 'curseforge' | 'no-assets') {
        dispatch('exportProfile', { type, dest: destination });
    }
    function refresh() {
        dispatch('refreshProfile');
    }

    return {
        ...toRefs(profile),
        maxMemory,
        minMemory,
        isServer,
        edit,
        exportTo,
        refresh,
        refreshing,
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

export function useProfileMods() {
    const { getters, dispatch } = useStore();

    const mods = computed({
        get() {
            return getters.selectedProfile.deployments.mods || [];
        },
        set(nv: string[]) {
            dispatch('editProfile', { deployments: { mods: nv } });
        },
    });

    return {
        mods,
    }
}
