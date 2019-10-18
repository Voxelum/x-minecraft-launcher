import { toRefs, computed, ref, watch, onMounted, onUnmounted } from "@vue/composition-api";
import { ProfileModule, CreateOption } from "universal/store/modules/profile";
import { Data } from "@vue/composition-api/dist/component";
import { getExpectVersion } from "universal/utils";
import { useStore } from "./useStore";

export function useProfile() {
    const { getters, dispatch } = useStore();
    const profile: ProfileModule.ServerAndModpack & Data = getters.selectedProfile as any;

    const maxMemory = computed(() => profile.maxMemory);
    const minMemory = computed(() => profile.minMemory);
    const author = computed(() => profile.author || '');

    const isServer = computed(() => profile.type === 'server');
    const refreshing = computed(() => getters.refreshing);
    const refs = toRefs(profile);

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
        ...refs,
        author,
        maxMemory,
        minMemory,
        isServer,
        edit,
        exportTo,
        refresh,
        refreshing,
    };
}

export function useProfileCreation() {
    const { dispatch } = useStore();
    function createAndSelectProfile(option: CreateOption) {
        return dispatch('createAndSelectProfile', option);
    }
    return {
        createAndSelectProfile,
    }
}

export function useProfileVersionBase() {
    const { getters } = useStore();
    const profile: ProfileModule.ServerOrModpack & Data = getters.selectedProfile as any;
    return {
        ...toRefs(profile.version),
    };
}

export function useProfileTemplates() {
    const { getters } = useStore();
    return {
        profiles: computed(() => getters.profiles),
        modpacks: computed(() => getters.modpacks),
    }
}


export function useProfileResourcePacks() {
    const { state, commit } = useStore();
    const resourcePacks = computed({
        get: () => state.profile.settings.resourcePacks,
        set: (p) => { commit('gamesettings', { resourcePacks: p }) }
    });
    return {
        resourcePacks,
    };
}

export function useProfileGameSetting() {
    const { state } = useStore();
    return {
        ...toRefs(state.profile.settings)
    }
}

export function useProfileVersion() {
    const { getters, dispatch } = useStore();

    const profile: ProfileModule.ServerOrModpack & Data = getters.selectedProfile as any;

    const refVersion = toRefs(profile.version);
    const folder = ref('');
    const id = computed(() => getExpectVersion(profile.version.minecraft,
        profile.version.forge,
        profile.version.liteloader));

    let watcher = () => { };

    dispatch('resolveVersion', profile.version)
        .then((f) => { folder.value = f; })
        .catch((e) => console.error(e));

    onMounted(() => {
        watcher = watch(id, () => {
            dispatch('resolveVersion', profile.version)
                .then((f) => { folder.value = f; })
                .catch((e) => console.error(e));
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
