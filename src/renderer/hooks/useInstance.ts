import { computed, onMounted, reactive, toRefs } from '@vue/composition-api';
import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions } from '@main/service/InstanceSavesService';
import { CreateOption } from '@main/service/InstanceService';
import { InstanceConfig } from '@universal/store/modules/instance';
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

    const path = computed(() => state.instance.path);
    const name = computed(() => getters.instance.name);
    const author = computed(() => getters.instance.author || '');
    const description = computed(() => getters.instance.description);
    const showLog = computed(() => getters.instance.showLog);
    const hideLauncher = computed(() => getters.instance.hideLauncher);
    const runtime = computed(() => getters.instance.runtime);
    const java = computed(() => getters.instance.java);
    const resolution = computed(() => getters.instance.resolution);
    const minMemory = computed(() => getters.instance.minMemory);
    const maxMemory = computed(() => getters.instance.maxMemory);
    const vmOptions = computed(() => getters.instance.vmOptions);
    const mcOptions = computed(() => getters.instance.mcOptions);
    const url = computed(() => getters.instance.url);
    const icon = computed(() => getters.instance.icon);
    const image = computed(() => getters.instance.image);
    const blur = computed(() => getters.instance.blur);
    const lastAccessDate = computed(() => getters.instance.lastAccessDate);
    const creationDate = computed(() => getters.instance.creationDate);
    const server = computed(() => getters.instance.server);
    return {
        path,
        name,
        author,
        description,
        showLog,
        hideLauncher,
        runtime,
        java,
        resolution,
        minMemory,
        maxMemory,
        vmOptions,
        mcOptions,
        url,
        icon,
        image,
        blur,
        lastAccessDate,
        creationDate,
        server,
        isServer: computed(() => getters.instance.server !== null),
        refreshing: computed(() => state.semaphore.instance > 0),
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
        ...useServiceOnly('InstanceIOService', 'importInstance', 'linkInstance'),
    };
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
    const { gameProfile } = useCurrentUser();
    const { createAndMount: createAndSelect } = useService('InstanceService');
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
            data.runtime = { ...instance.runtime };
            data.java = instance.java;
            data.showLog = instance.showLog;
            data.hideLauncher = instance.hideLauncher;
            data.vmOptions = [...instance.vmOptions];
            data.mcOptions = [...instance.mcOptions];
            data.maxMemory = instance.maxMemory;
            data.minMemory = instance.minMemory;
            data.author = instance.author;
            data.description = instance.description;
            data.url = instance.url;
            data.icon = instance.icon;
            data.image = instance.image;
            data.blur = instance.blur;
            data.server = instance.server ? { ...instance.server } : undefined;
        },
    };
}

export function useInstanceVersionBase() {
    const { getters } = useStore();
    const minecraft = computed(() => getters.instance.runtime.minecraft);
    const forge = computed(() => getters.instance.runtime.forge);
    const fabricLoader = computed(() => getters.instance.runtime.fabricLoader);
    const yarn = computed(() => getters.instance.runtime.yarn);
    return {
        minecraft,
        forge,
        fabricLoader,
        yarn,
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
    const { loadInstanceGameSettings, edit, showInFolder } = useService('InstanceGameSettingService');
    const refresh = () => loadInstanceGameSettings(state.instance.path);
    const fancyGraphics = computed(() => state.instance.settings.fancyGraphics);
    const renderClouds = computed(() => state.instance.settings.renderClouds);
    const ao = computed(() => state.instance.settings.ao);
    const entityShadows = computed(() => state.instance.settings.entityShadows);
    const particles = computed(() => state.instance.settings.particles);
    const mipmapLevels = computed(() => state.instance.settings.mipmapLevels);
    const useVbo = computed(() => state.instance.settings.useVbo);
    const fboEnable = computed(() => state.instance.settings.fboEnable);
    const enableVsync = computed(() => state.instance.settings.enableVsync);
    const anaglyph3d = computed(() => state.instance.settings.anaglyph3d);

    return {
        fancyGraphics,
        renderClouds,
        ao,
        entityShadows,
        particles,
        mipmapLevels,
        useVbo,
        fboEnable,
        enableVsync,
        anaglyph3d,
        showInFolder,
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


    const folder = computed(() => getters.instanceVersion.folder);
    const id = computed(() => getExpectVersion(
        getters.instance.runtime.minecraft,
        getters.instance.runtime.forge,
        getters.instance.runtime.liteloader,
    ));

    return {
        ...useInstanceVersionBase(),
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
