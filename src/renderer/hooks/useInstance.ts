import { computed, onMounted, onUnmounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api';
import { GameSetting } from '@xmcl/minecraft-launcher-core';
import { CreateOption, InstanceConfig } from 'universal/store/modules/instance';
import { Resource } from 'universal/store/modules/resource';
import { getExpectVersion } from 'universal/utils';
import Vue from 'vue';
import { useStore } from './useStore';
import { useCurrentUser } from './useUser';
import { useMinecraftVersions } from './useVersion';

/**
 * Use the general info of the instance
 */
export function useInstance() {
    const { getters, services, state } = useStore();
    const instance: InstanceConfig & { [key: string]: unknown } = getters.instance as any;

    const maxMemory = computed(() => instance.maxMemory);
    const minMemory = computed(() => instance.minMemory);
    const author = computed(() => instance.author || '');

    const server = computed(() => instance.server);
    const refreshing = computed(() => state.semaphore.instance > 0);
    const refs = toRefs(instance);

    return {
        ...refs,
        author,
        maxMemory,
        minMemory,
        isServer: computed(() => instance.server !== undefined),
        server,
        edit: services.InstanceService.editInstance,
        exportTo: services.InstanceService.exportInstance,
        refresh: services.InstanceService.refreshInstance,
        refreshing,
    };
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
    const { getters, services } = useStore();
    return {
        instances: computed(() => getters.instances),
        selectInstance: services.InstanceService.selectInstance,
        deleteInstance: services.InstanceService.deleteInstance,
        refreshInstances: services.InstanceService.refreshInstances,
        importInstance: services.InstanceService.importInstance,
    };
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
    const { services } = useStore();
    const { name } = useCurrentUser();
    const { release } = useMinecraftVersions();
    const data: CreateOption = reactive({
        name: '',
        version: { forge: '', minecraft: release.value?.id || '', liteloader: '' },
        java: '',
        showLog: false,
        hideLauncher: true,
        vmOptions: [],
        mcOptions: [],
        maxMemory: undefined,
        minMemory: undefined,
        author: name.value,
        description: '',
        deployments: { mods: [] },
        resolution: undefined,
        url: '',
        icon: '',
        image: '',
        blur: 4,
        host: '',
        port: -1,
    });
    const refs = toRefs(data);
    const required: Required<typeof refs> = toRefs(data) as any;
    return {
        ...required,
        /**
         * Commit this creation. It will create and select the instance.
         */
        create() {
            return services.InstanceService.createAndSelect(data);
        },
        /**
         * Reset the change
         */
        reset() {
            data.name = 'Latest Game';
            data.runtime = {
                minecraft: release.value?.id || '',
                forge: '',
                liteloader: '',
            };
            data.java = '';
            data.showLog = false;
            data.hideLauncher = true;
            data.vmOptions = [];
            data.mcOptions = [];
            data.maxMemory = undefined;
            data.minMemory = undefined;
            data.author = name.value;
            data.description = '';
            data.deployments = { mods: [] };
            data.resolution = undefined;
            data.url = '';
            data.icon = '';
            data.image = '';
            data.blur = 4;
        },
        /**
         * Use the same configuration as the input instance
         * @param instance The instance will be copied
         */
        use(instance: InstanceConfig) {
            data.name = instance.name;
            data.runtime = instance.runtime;
            data.java = instance.java;
            data.showLog = instance.showLog;
            data.hideLauncher = instance.hideLauncher;
            data.vmOptions = instance.vmOptions;
            data.mcOptions = instance.mcOptions;
            data.maxMemory = instance.maxMemory;
            data.minMemory = instance.minMemory;
            data.author = instance.author;
            data.description = instance.description;
            data.url = instance.url;
            data.icon = instance.icon;
            data.image = instance.image;
            data.blur = instance.blur;
            data.server = instance.server;
        },
    };
}

export function useInstanceVersionBase() {
    const { getters } = useStore();
    const profile: InstanceConfig = getters.instance;
    return {
        ...toRefs(profile.runtime),
    };
}

export function useProfileTemplates() {
    const { getters } = useStore();
    return {
        profiles: computed(() => getters.instances),
        modpacks: computed(() => getters.modpacks),
    };
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
    const { state, commit } = useStore();
    const resourcePacks: Ref<string[]> = computed({
        get: () => state.instance.settings.resourcePacks,
        set: (p) => { commit('instanceGameSettings', { resourcePacks: p }); },
    }) as any;
    return {
        resourcePacks,
    };
}

export function useInstanceGameSetting() {
    const { state, commit, services } = useStore();
    return {
        ...toRefs(state.instance.settings),
        refresh() {
            return services.InstanceService.loadInstanceGameSettings();
        },
        commitChange(settings: GameSetting.Frame) {
            commit('instanceGameSettings', settings);
        },
    };
}

export function useInstanceVersion() {
    const { getters, services } = useStore();

    const instance: InstanceConfig = getters.instance;

    const refVersion = toRefs(instance.runtime);
    const folder = ref('');
    const id = computed(() => getExpectVersion(
        instance.runtime.minecraft,
        instance.runtime.forge,
        instance.runtime.liteloader,
    ));

    let watcher = () => { };

    onMounted(() => {
        watcher = watch(id, () => {
            services.VersionService.resolveVersion(instance.runtime)
                .then((f) => {
                    folder.value = f;
                }, () => {
                    folder.value = '';
                    setTimeout(() => {
                        services.VersionService.resolveVersion(instance.runtime).then((f) => {
                            folder.value = f;
                        });
                    }, 1000);
                });
        });
    });
    onUnmounted(() => {
        watcher();
    });

    return {
        ...refVersion,
        id,
        folder,
    };
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
    const { state, getters, services } = useStore();

    const allModResources = state.resource.domains.mods;
    const data = reactive({
        mods: [] as string[],
    });
    /**
     * Unused mod resources
     */
    const unusedModResources = computed(() => allModResources.filter(r => r.source.uri.every(i => data.mods.indexOf(i) === -1)));
    /**
     * Used mod resources
     */
    const usedModResources = computed(() => data.mods.map(i => state.resource.directory[i]));

    /**
     * Add a new mod resource to the used list
     */
    function add(res: Resource<any>) {
        data.mods.push(res.source.uri[0]);
    }

    /**
     * Remove a mod resource from used list
     */
    function remove(index: number) {
        Vue.delete(data.mods, index);
    }

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        services.InstanceService.editInstance({ deployments: { mods: data.mods } });
    }

    onMounted(() => {
        data.mods = [...getters.instance.deployments.mod];
    });

    return {
        unusedModResources,
        usedModResources,
        add,
        remove,
        commit,
    };
}
export function useInstanceSaves() {
    const { state, services } = useStore();
    return {
        id: computed(() => state.instance.id),
        saves: computed(() => state.instance.saves),
        importSave: services.InstanceService.importSave,
        deleteSave: services.InstanceService.deleteSave,
        exportSave: services.InstanceService.exportSave,
        copySave: services.InstanceService.copySave,
        refresh: services.InstanceService.loadInstanceSaves,
        loadAllPreviews: services.InstanceService.getAllInstancesSavePreview,
    };
}
export function useInstanceLogs() {
    const { state, services } = useStore();
    return {
        id: computed(() => state.instance.id),
        getCrashReportContent: services.InstanceService.getCrashReportContent,
        getLogContent: services.InstanceService.getLogContent,
        listCrashReports: services.InstanceService.listCrashReports,
        listLogs: services.InstanceService.listLogs,
        removeCrashReport: services.InstanceService.removeCrashReport,
        removeLog: services.InstanceService.removeLog,
        showLog: services.InstanceService.showLog,
        showCrashReport: services.InstanceService.showCrash,
    };
}
