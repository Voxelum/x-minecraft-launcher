import { Status } from '@universal/store/modules/version';
import { isNonnull } from '@universal/util/assert';
import { computed, onMounted, onUnmounted, reactive, Ref, toRefs, watch } from '@vue/composition-api';
import { Version as MinecraftVersion } from '@xmcl/installer/minecraft';
import { useInstanceVersion } from './useInstance';
import { useService, useServiceOnly } from './useService';
import { useStore } from './useStore';
import { useBusy } from './useSemaphore';

export function useVersions() {
    return useServiceOnly('VersionService', 'deleteVersion', 'refreshVersion', 'refreshVersions', 'showVersionDirectory', 'showVersionsDirectory', 'reinstall');
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
    const refreshing = useBusy('refreshMinecraft');
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
        statuses,
        versions,
        refreshing,
        release,
        snapshot,
        refresh: refreshMinecraft,
    };
}

export function useMinecraftVersionFilter(filterText: Ref<string>) {
    const data = reactive({
        acceptingRange: '',
        showAlpha: false,
    });

    function filter(v: MinecraftVersion) {
        if (!data.showAlpha && v.type !== 'release') return false;
        // if (!isCompatible(data.acceptingRange, v.id)) return false;
        return v.id.indexOf(filterText.value) !== -1;
    }

    return {
        ...toRefs(data),
        filter,
    };
}

export function useFabricVersions() {
    const { state } = useStore();
    const { refreshFabric } = useService('InstallService');
    const loaderVersions = computed(() => state.version.fabric.loaders ?? []);
    const yarnVersions = computed(() => state.version.fabric.yarns ?? []);
    const loaderStatus = computed(() => {
        const statusMap: { [key: string]: Status } = {};
        const locals: { [k: string]: boolean } = {};
        state.version.local.forEach((ver) => {
            if (ver.fabricLoader) locals[ver.fabricLoader] = true;
        });
        state.version.fabric.loaders.forEach((v) => {
            statusMap[v.version] = locals[v.version] ? 'local' : 'remote';
        });
        return statusMap;
    });
    const yarnStatus = computed(() => {
        const statusMap: { [key: string]: Status } = {};
        const locals: { [k: string]: boolean } = {};
        state.version.local.forEach((ver) => {
            if (ver.yarn) locals[ver.yarn] = true;
        });
        state.version.fabric.yarns.forEach((v) => {
            statusMap[v.version] = locals[v.version] ? 'local' : 'remote';
        });
        return statusMap;
    });

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
        loaderStatus,
        yarnStatus,
    };
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
    const { state } = useStore();
    const { refreshForge } = useService('InstallService');
    const versions = computed(() => state.version.forge.find(v => v.mcversion === minecraftVersion.value)?.versions ?? []);
    const refreshing = useBusy('refreshForge');

    const recommended = computed(() => {
        const vers = versions.value;
        if (!vers) return undefined;
        return vers.find(v => v.type === 'recommended');
    });
    const latest = computed(() => {
        const vers = versions.value;
        if (!vers) return undefined;
        return vers.find(v => v.type === 'latest');
    });
    const statuses = computed(() => {
        const statusMap: { [key: string]: Status } = {};
        const localForgeVersion: { [k: string]: boolean } = {};
        state.version.local.forEach((ver) => {
            if (ver.forge) localForgeVersion[ver.forge] = true;
        });
        state.version.forge.forEach((container) => {
            container.versions.forEach((version) => {
                statusMap[version.version] = localForgeVersion[version.version] ? 'local' : 'remote';
            });
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
        return refreshForge({ mcversion: minecraftVersion.value, force: true });
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

    const versions = computed(() => Object.values(state.version.liteloader.versions[minecraftVersion.value] || {}).filter(isNonnull));
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
