import { Status } from '@universal/store/modules/version';
import { isNotNull } from '@universal/util/assert';
import { computed, onMounted, onUnmounted, Ref, watch } from '@vue/composition-api';
import { useInstanceVersion } from './useInstance';
import { useService, useServiceOnly } from './useService';
import { useBusy, useStore } from './useStore';

export function useVersions() {
    return useServiceOnly('VersionService', 'deleteVersion', 'refreshVersion', 'refreshVersions', 'showVersionDirectory', 'showVersionsDirectory');
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
    const { state } = useStore();
    const { refreshMinecraft } = useService('InstallService');
    const isMinecraftRefreshing = useBusy('refreshMinecraft');
    const versions = computed(() => state.version.minecraft.versions);
    const release = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.release));
    const snapshot = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.snapshot));
    const statuses = computed(() => {
        const localVersions: { [k: string]: boolean } = {};
        state.version.local.forEach((ver) => {
            if (ver.minecraft) localVersions[ver.minecraft] = true;
        });
        const statusMap: { [key: string]: Status } = {};
        for (const ver of state.version.minecraft.versions) {
            statusMap[ver.id] = localVersions[ver.id] ? 'local' : 'remote';
        }
        return statusMap;
    });

    onMounted(() => {
        refreshMinecraft();
    });

    return {
        versions,
        isMinecraftRefreshing,
        release,
        snapshot,
        statuses,
    };
}

export function useFabricVersions() {
    const { state } = useStore();
    const { refreshFabric } = useService('InstallService');
    const loaderVersions = computed(() => state.version.fabric.loaders ?? []);
    const yarnVersions = computed(() => state.version.fabric.yarns ?? []);

    function refresh(force = false) {
        return refreshFabric(force);
    }

    onMounted(() => {
        refresh();
    });

    return {
        loaderVersions,
        yarnVersions,
        refresh,
    };
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
    const { state, getters } = useStore();
    const { refreshForge } = useService('InstallService');
    const versions = computed(() => (state.version.forge[minecraftVersion.value] || { versions: [] }).versions);
    const refreshing = computed(() => getters.busy('refreshForge'));
    const recommended = computed(() => getters.forgeRecommendedOf(minecraftVersion.value));
    const latest = computed(() => getters.forgeLatestOf(minecraftVersion.value));
    const statuses = computed(() => {
        const statusMap: { [key: string]: Status } = {};
        const localForgeVersion: { [k: string]: boolean } = {};
        state.version.local.forEach((ver) => {
            if (ver.forge) localForgeVersion[ver.forge] = true;
        });

        Object.keys(state.version.forge).forEach((mcversion) => {
            const container = state.version.forge[mcversion];
            if (container.versions) {
                container.versions.forEach((version) => {
                    statusMap[version.version] = localForgeVersion[version.version] ? 'local' : 'remote';
                });
            }
        });
        return statusMap;
    });

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

    const versions = computed(() => Object.values(state.version.liteloader.versions[minecraftVersion.value] || {}).filter(isNotNull));
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
