import { computed, onMounted, onUnmounted, Ref, watch } from '@vue/composition-api';
import { notNull } from '@universal/util/assert';
import { useInstanceVersion } from './useInstance';
import { useStore, useBusy } from './useStore';
import { useService } from './useService';

export function useVersions() {
    return useService('VersionService');
}

export function useLocalVersions() {
    const { state } = useStore();
    const localVersions = computed(() => state.version.local);
    const { minecraft, forge, liteloader } = useInstanceVersion();
    const selected = computed(() => localVersions.value.find(v => v.minecraft === minecraft.value
        && v.forge === forge.value && v.liteloader === liteloader.value));

    return {
        localVersions,
        selected,
        ...useVersions(),
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
    const { state, getters } = useStore();
    const { refreshForge } = useService('InstallService');
    const versions = computed(() => (state.version.forge[minecraftVersion.value] || { versions: [] }).versions);
    const refreshing = computed(() => getters.busy('refreshForge'));
    const statuses = computed(() => getters.forgeStatuses);
    const recommended = computed(() => getters.forgeRecommendedOf(minecraftVersion.value));
    const latest = computed(() => getters.forgeLatestOf(minecraftVersion.value));

    let handle = () => { };
    onMounted(() => {
        handle = watch(minecraftVersion, () => {
            if (versions.value.length === 0) {
                refreshForge({ mcversion: minecraftVersion.value });
            }
        });
    });
    onUnmounted(() => {
        handle();
    });

    function refresh() {
        return refreshForge({ mcversion: minecraftVersion.value });
    }

    return {
        versions,
        refresh,
        refreshing,
        statuses,
        recommended,
        latest,
    };
}

export function useLiteloaderVersions(minecraftVersion: Ref<string>) {
    const { state } = useStore();
    const { refreshLiteloader } = useService('InstallService');

    const versions = computed(() => Object.values(state.version.liteloader.versions[minecraftVersion.value] || {}).filter(notNull));
    const refreshing = useBusy('refreshLiteloader');
    let handle = () => { };
    onMounted(() => {
        handle = watch(minecraftVersion, () => {
            if (!versions.value) {
                refreshLiteloader();
            }
        });
    });
    onUnmounted(() => {
        handle();
    });

    function refresh() {
        return refreshLiteloader();
    }

    return {
        versions,
        refresh,
        refreshing,
    };
}
