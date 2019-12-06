import { computed, onMounted, onUnmounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api';
import { Data } from '@vue/composition-api/dist/component';
import { GameSetting } from '@xmcl/minecraft-launcher-core';
import { CreateOption, ServerAndModpack, ServerOrModpack } from 'universal/store/modules/profile';
import { getExpectVersion } from 'universal/utils';
import { useStore } from './useStore';

/**
 * Use the general info of the instance
 */
export function useInstance() {
    const { getters, services, state } = useStore();
    const profile: ServerAndModpack & Data & { type: string } = getters.selectedProfile as any;

    const maxMemory = computed(() => profile.maxMemory);
    const minMemory = computed(() => profile.minMemory);
    const author = computed(() => profile.author || '');

    const isServer = computed(() => profile.type === 'server');
    const refreshing = computed(() => state.semaphore.instance > 0);
    const refs = toRefs(profile);
    const type: Ref<string> = refs.type as any;

    return {
        ...refs,
        type,
        author,
        maxMemory,
        minMemory,
        isServer,
        edit: services.InstanceService.editInstance,
        exportTo: services.InstanceService.exportProfile,
        refresh: services.InstanceService.refreshProfile,
        refreshing,
    };
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
    const { getters, services } = useStore();
    return {
        instances: getters.profiles,
        selectInstance: services.InstanceService.selectInstance,
        deleteInstance: services.InstanceService.deleteInstance,
        pingProfiles: services.InstanceService.refreshAll,
        importInstance: services.InstanceService.importProfile,
    };
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
    const { services } = useStore();
    const data: CreateOption = reactive({
        type: 'modpack',
        name: '',
        version: { forge: '', minecraft: '', liteloader: '' },
        java: { path: '', version: '', majorVersion: 0 },
        showLog: false,
        hideLauncher: true,
        vmOptions: [],
        mcOptions: [],
        maxMemory: undefined,
        minMemory: undefined,
        author: '',
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
            return services.InstanceService.createAndSelect({ ...data, type: 'modpack' });
        },
        /**
         * Reset the change
         */
        reset() {
            data.name = '';
            data.version = { forge: '', minecraft: '', liteloader: '' };
            data.java = { path: '', version: '', majorVersion: 0 };
            data.showLog = false;
            data.hideLauncher = true;
            data.vmOptions = [];
            data.mcOptions = [];
            data.maxMemory = undefined;
            data.minMemory = undefined;
            data.author = '';
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
        use(instance: ServerOrModpack) {
            data.type = instance.type;
            data.name = instance.name;
            data.version = instance.version;
            data.java = instance.java;
            data.showLog = instance.showLog;
            data.hideLauncher = instance.hideLauncher;
            data.vmOptions = instance.vmOptions;
            data.mcOptions = instance.mcOptions;
            data.maxMemory = instance.maxMemory;
            data.minMemory = instance.minMemory;
            if ('author' in instance) {
                data.author = instance.author;
                data.description = instance.description;
            } else {
                data.host = instance.host;
                data.port = instance.port;
            }
            data.url = instance.url;
            data.icon = instance.icon;
            data.image = instance.image;
            data.blur = instance.blur;
        },
    };
}

export function useInstanceVersionBase() {
    const { getters } = useStore();
    const profile: ServerOrModpack & Data = getters.selectedProfile as any;
    return {
        ...toRefs(profile.version),
    };
}

export function useProfileTemplates() {
    const { getters } = useStore();
    return {
        profiles: computed(() => getters.profiles),
        modpacks: computed(() => getters.modpacks),
    };
}

/**
 * The hook return a reactive resource pack array.
 */
export function useProfileResourcePacks() {
    const { state, commit } = useStore();
    const resourcePacks: Ref<string[]> = computed({
        get: () => state.profile.settings.resourcePacks,
        set: (p) => { commit('gamesettings', { resourcePacks: p }); },
    }) as any;
    return {
        resourcePacks,
    };
}

export function useProfileGameSetting() {
    const { state, commit, services } = useStore();
    return {
        ...toRefs(state.profile.settings),
        refresh() {
            return services.InstanceService.loadProfileGameSettings();
        },
        commitChange(settings: GameSetting.Frame) {
            commit('gamesettings', settings);
        },
    };
}

export function useProfileVersion() {
    const { getters, services } = useStore();

    const profile: ServerOrModpack & Data = getters.selectedProfile as any;

    const refVersion = toRefs(profile.version);
    const folder = ref('');
    const id = computed(() => getExpectVersion(
        profile.version.minecraft,
        profile.version.forge,
        profile.version.liteloader,
    ));

    let watcher = () => { };

    onMounted(() => {
        watcher = watch(id, () => {
            services.VersionService.resolveVersion(profile.version)
                .then((f) => { folder.value = f; }, () => { folder.value = ''; });
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

export function useProfileMods() {
    const { getters, services } = useStore();

    const mods: Ref<string[]> = computed({
        get() {
            return getters.selectedProfile.deployments.mods || [];
        },
        set(nv: string[]) {
            services.InstanceService.editInstance({ deployments: { mods: nv } });
        },
    }) as any;

    return {
        mods,
    };
}
export function useInstanceSaves() {
    const { state, services } = useStore();
    return {
        id: computed(() => state.profile.id),
        saves: computed(() => state.profile.saves),
        importSave: services.InstanceService.importSave,
        deleteSave: services.InstanceService.deleteSave,
        exportSave: services.InstanceService.exportSave,
        copySave: services.InstanceService.copySave,
        refresh: services.InstanceService.loadProfileSaves,
        loadAllPreviews: services.InstanceService.loadAllProfileSaves,
    };
}
export function useInstanceLogs() {
    const { state, services } = useStore();
    return {
        id: computed(() => state.profile.id),
        getCrashReportContent: services.InstanceService.getCrashReportContent,
        getLogContent: services.InstanceService.getLogContent,
        listCrashReports: services.InstanceService.listCrashReports,
        listLogs: services.InstanceService.listLogs,
        removeCrashReport: services.InstanceService.removeCrashReport,
        removeLog: services.InstanceService.removeLog,
    };
}
