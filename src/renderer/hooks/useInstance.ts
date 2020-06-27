import { computed, onMounted, reactive, toRefs } from '@/vue';
import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions } from '@main/service/InstanceSavesService';
import { CreateOption, InstanceConfig } from '@universal/store/modules/instance';
import { getExpectVersion } from '@universal/util/version';
import { Frame as GameSetting } from '@xmcl/gamesetting';
import { useBusy } from './useSemaphore';
import { useService, useServiceOnly } from './useService';
import { useStore } from './useStore';
import { useCurrentUser } from './useUser';
import { useMinecraftVersions } from './useVersion';

/**
 * Use the general info of the instance
 */
export function useInstance() {
    const { getters, state } = useStore();
    const instance: InstanceConfig & { [key: string]: unknown } = getters.instance as any;

    const maxMemory = computed(() => instance.maxMemory);
    const minMemory = computed(() => instance.minMemory);
    const author = computed(() => instance.author || '');

    const server = computed(() => instance.server);
    const refreshing = computed(() => state.semaphore.instance > 0);
    const javaPath = computed(() => instance.java);

    const refs = toRefs(instance);
    return {
        ...refs,
        author,
        maxMemory,
        minMemory,
        isServer: computed(() => instance.server !== null),
        javaPath,
        server,
        refreshing,

        ...useServiceOnly('InstanceService', 'editInstance', 'refreshServerStatus'),
        ...useServiceOnly('InstanceIOService', 'exportInstance'),
    };
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
    const { getters } = useStore();
    return {
        instances: computed(() => getters.instances),

        ...useServiceOnly('InstanceService', 'mountInstance', 'deleteInstance', 'refreshServerStatusAll'),
        ...useServiceOnly('InstanceIOService', 'importInstance'),
    };
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
    const { gameProfile } = useCurrentUser();
    const { createAndSelect } = useService('InstanceService');
    const { release } = useMinecraftVersions();
    const data = reactive({
        name: '',
        runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '', fabricLoader: '', yarn: '' },
        java: '',
        showLog: false,
        hideLauncher: true,
        vmOptions: [] as string[],
        mcOptions: [] as string[],
        maxMemory: undefined as undefined | number,
        minMemory: undefined as undefined | number,
        author: gameProfile.value.name,
        description: '',
        deployments: { mods: [], resourcepacks: [] },
        resolution: undefined as undefined | CreateOption['resolution'],
        url: '',
        icon: '',
        image: '',
        blur: 4,
        server: null as undefined | CreateOption['server'],
    });
    const refs = toRefs(data);
    const required: Required<typeof refs> = toRefs(data) as any;
    return {
        ...required,
        /**
         * Commit this creation. It will create and select the instance.
         */
        create() {
            return createAndSelect(data);
        },
        /**
         * Reset the change
         */
        reset() {
            data.name = '';
            data.runtime = {
                minecraft: release.value?.id || '',
                forge: '',
                liteloader: '',
                fabricLoader: '',
                yarn: '',
            };
            data.java = '';
            data.showLog = false;
            data.hideLauncher = true;
            data.vmOptions = [];
            data.mcOptions = [];
            data.maxMemory = undefined;
            data.minMemory = undefined;
            data.author = gameProfile.value.name;
            data.description = '';
            data.deployments = { mods: [], resourcepacks: [] };
            data.resolution = undefined;
            data.url = '';
            data.icon = '';
            data.image = '';
            data.blur = 4;
            data.server = null;
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

export function useInstanceTemplates() {
    const { getters, state } = useStore();
    return {
        instances: computed(() => getters.instances),
        modpacks: computed(() => state.resource.domains.modpacks),
    };
}


export function useInstanceGameSetting() {
    const { state } = useStore();
    const { loadInstanceGameSettings, edit } = useService('InstanceGameSettingService');
    const refresh = () => loadInstanceGameSettings(state.instance.path);
    onMounted(() => {
        refresh();
    });
    return {
        settings: state.instance.settings,
        refreshing: useBusy('loadInstanceGameSettings'),
        refresh,
        commit(settings: GameSetting) {
            edit(settings);
        },
    };
}

export function useInstanceSaves() {
    const { state } = useStore();
    const { cloneSave, deleteSave, exportSave, loadAllInstancesSaves, importSave, mountInstanceSaves } = useService('InstanceSavesService');
    const refresh = () => mountInstanceSaves(state.instance.path);
    return {
        refresh,
        cloneSave: (options: CloneSaveOptions) => cloneSave(options).finally(refresh),
        deleteSave: (options: DeleteSaveOptions) => deleteSave(options).finally(refresh),
        exportSave,
        loadAllInstancesSaves,
        importSave: (options: ImportSaveOptions) => importSave(options).finally(refresh),
        path: computed(() => state.instance.path),
        saves: computed(() => state.instance.saves),
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

export function useInstanceLogs() {
    const { state } = useStore();
    return {
        path: computed(() => state.instance.path),
        ...useServiceOnly('InstanceLogService', 'getCrashReportContent', 'getLogContent', 'listCrashReports', 'listLogs', 'removeCrashReport', 'removeLog', 'showCrash', 'showLog'),
    };
}
