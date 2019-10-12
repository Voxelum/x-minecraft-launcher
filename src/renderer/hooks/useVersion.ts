import { useStore } from "./useStore";
import { Ref, onMounted, watch, computed, onUnmounted } from "@vue/composition-api";
import { useCurrentProfileVersion } from "./useCurrentProfile";

export function useVersions() {
    const { dispatch } = useStore();

    /**
     * Delete the local version with `id`
     */
    function deleteVersion(id: string) {
        return dispatch('deleteVersion', id);
    }
    return {
        deleteVersion,
    }
}

export function useLocalVersions() {
    const { state } = useStore();
    const localVersions = computed(() => state.version.local);
    const { minecraft, forge, liteloader } = useCurrentProfileVersion();
    const selected = computed(() => localVersions.value.find(v => v.minecraft == minecraft.value
        && v.forge === forge.value && v.liteloader === liteloader.value));

    return {
        ...useVersions(),
        localVersions,
        selected,
    };
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
    const { dispatch, state } = useStore();

    const list = computed(() => {
        return state.version.forge[minecraftVersion.value] || { mcversion: minecraftVersion.value, timestamp: -1, versions: [] }
    });
    const refreshing = computed(() => state.version.refreshingForge);

    let handle = () => { };
    onMounted(() => {
        handle = watch(minecraftVersion, (v) => {
            if (list.value.versions.length === 0) {
                dispatch('refreshForge', minecraftVersion.value)
            }
        })
    })
    onUnmounted(() => {
        handle();
    });

    function refresh() {
        return dispatch('refreshForge', minecraftVersion.value);
    }

    return {
        list,
        refresh,
        refreshing,
    }
}