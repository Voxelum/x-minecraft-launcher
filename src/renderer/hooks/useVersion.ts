import { useStore } from "./useStore";
import { Ref, onMounted, watch, computed, onUnmounted } from "@vue/composition-api";
import { useProfileVersion } from "./useProfile";
import { remote } from "electron";

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
    const { minecraft, forge, liteloader } = useProfileVersion();
    const selected = computed(() => localVersions.value.find(v => v.minecraft == minecraft.value
        && v.forge === forge.value && v.liteloader === liteloader.value));

    function showVersionDirectory(version: string) {
        remote.shell.openItem(`${state.root}/versions/${version}`);
    }
    function showVersionsDirectory() {
        remote.shell.openItem(`${state.root}/versions`);
    }

    return {
        ...useVersions(),
        localVersions,
        selected,
        showVersionDirectory,
        showVersionsDirectory,
    };
}

export function useMinecraftVersions() {
    const { state, getters } = useStore();
    const versions = computed(() => state.version.minecraft.versions);
    const release = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.release));
    const snapshot = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.snapshot));
    const statuses = computed(() => getters.minecraftStatuses);

    return {
        versions,
        release,
        snapshot,
        statuses,
    };
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
    const { dispatch, state, getters } = useStore();

    const versions = computed(() => (state.version.forge[minecraftVersion.value] || { versions: [] }).versions);
    const refreshing = computed(() => state.version.refreshingForge);
    const statuses = computed(() => getters.forgeStatuses);
    const recommended = computed(() => getters.forgeRecommendedOf(minecraftVersion.value));
    const latest = computed(() => getters.forgeLatestOf(minecraftVersion.value));

    let handle = () => { };
    onMounted(() => {
        handle = watch(minecraftVersion, (v) => {
            if (versions.value.length === 0) {
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
        versions,
        refresh,
        refreshing,
        statuses,
        recommended,
        latest,
    }
}