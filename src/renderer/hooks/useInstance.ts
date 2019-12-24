import { computed, onMounted, reactive, ref, Ref, toRefs } from '@vue/composition-api';
import { Frame as GameSetting } from '@xmcl/gamesetting';
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
    const javaPath = computed(() => state.instance.java);

    function setJavaPath(path: string) {
        services.InstanceService.setJavaPath(path);
    }

    const refs = toRefs(instance);
    return {
        ...refs,
        author,
        /**
         * min memory
         */
        maxMemory,
        minMemory,
        isServer: computed(() => instance.server !== undefined),
        javaPath,
        server,
        refreshing,

        edit: services.InstanceService.editInstance,
        exportTo: services.InstanceService.exportInstance,
        refresh: services.InstanceService.refreshServerStatus,
        setJavaPath,
    };
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
    const { getters, services } = useStore();
    return {
        instances: computed(() => getters.instances),
        selectInstance: services.InstanceService.mountInstance,
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
        runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '' },
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
    const serverRef: Ref<Required<CreateOption>['server']> = ref({
        host: '',
        port: undefined,
    });
    const refs = toRefs(data);
    const required: Required<typeof refs> = toRefs(data) as any;
    return {
        ...required,
        server: serverRef,
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
    const { state, getters, services, commit: cm } = useStore();

    const data = reactive({
        packs: [] as string[],
    });
    /**
     * Unused resources
     */
    const unusedPackResources = computed(() => state.resource.domains.resourcepacks
        .filter(r => r.source.uri.every(i => data.packs.indexOf(i) === -1)));
    /**
     * Used resources
     */
    const usedPackResources = computed(() => data.packs.map(i => state.resource.directory[i]));

    /**
     * Add a new resource to the used list
     */
    function add(res: Resource<any>) {
        data.packs.push(res.source.uri[0]);
    }

    /**
     * Remove a resource from used list
     */
    function remove(index: number) {
        Vue.delete(data.packs, index);
    }

    function swap(from: number, to: number) {
        const last = data.packs[to];
        data.packs[to] = last;
        data.packs[from] = last;
    }

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        cm('instanceGameSettings', { resourcePacks: usedPackResources.value.map(r => r.name + r.ext) });
        services.InstanceService.editInstance({ deployments: { resourcepacks: data.packs } });
    }

    onMounted(() => {
        data.packs = [...getters.instance.deployments.resourcepacks];
    });

    return {
        unusedPackResources,
        usedPackResources,
        add,
        remove,
        commit,
        swap,
    };
}

export function useInstanceGameSetting() {
    const { state, commit, services } = useStore();
    return {
        ...toRefs(state.instance.settings),
        refresh() {
            return services.InstanceService.loadInstanceGameSettings();
        },
        commitChange(settings: GameSetting) {
            commit('instanceGameSettings', settings);
        },
    };
}

/**
 * Use references of all the version info of this instance
 */
export function useInstanceVersion() {
    const { getters } = useStore();

    const instance: InstanceConfig = getters.instance;

    const refVersion = toRefs(instance.runtime);
    const folder = computed(() => getters.instanceVersion.folder);
    const id = computed(() => getExpectVersion(
        instance.runtime.minecraft,
        instance.runtime.forge,
        instance.runtime.liteloader,
    ));

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

    const data = reactive({
        mods: [] as string[],
    });
    /**
     * Unused mod resources
     */
    const unusedModResources = computed(() => state.resource.domains.mods
        .filter(r => r.source.uri.every(i => data.mods.indexOf(i) === -1)));
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
        data.mods = [...getters.instance.deployments.mods];
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
        id: computed(() => state.instance.path),
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
        id: computed(() => state.instance.path),
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
