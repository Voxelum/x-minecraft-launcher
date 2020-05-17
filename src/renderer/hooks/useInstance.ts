import unknownPack from '@/assets/unknown_pack.png';
import { computed, onMounted, onUnmounted, reactive, ref, Ref, toRefs } from '@/vue';
import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions } from '@main/service/InstanceSavesService';
import { CreateOption, InstanceConfig } from '@universal/store/modules/instance';
import { isNonnull } from '@universal/util/assert';
import { isModResource, isResourcePackResource, FabricResource, ForgeResource, LiteloaderResource, Resource } from '@universal/util/resource';
import { getExpectVersion } from '@universal/util/version';
import { Frame as GameSetting } from '@xmcl/gamesetting';
import { PackMeta } from '@xmcl/resourcepack';
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
    const javaPath = computed(() => state.instance.java);

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

        ...useServiceOnly('InstanceService', 'editInstance', 'setJavaPath', 'refreshServerStatus'),
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
    const { name } = useCurrentUser();
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
        author: name.value,
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
            data.author = name.value;
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

export function useProfileTemplates() {
    const { getters } = useStore();
    return {
        profiles: computed(() => getters.instances),
        modpacks: computed(() => getters.modpacks),
    };
}

export interface ResourcePackItem extends PackMeta.Pack {
    name: string;
    id: string;
    url: string[];
    acceptingRange: string;
    icon: string;
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
    const { state, getters } = useStore();
    const { editInstance } = useService('InstanceService');
    const { edit } = useService('InstanceGameSettingService');

    const data = reactive({
        packs: [] as ResourcePackItem[],
    });

    function getResourcepackFormat(meta: any) {
        return meta ? meta.format || meta.pack_format : 3;
    }
    function getResourcePackItem(resource: Resource<PackMeta.Pack>): ResourcePackItem {
        const icon = `${resource.path.substring(0, resource.path.length - resource.ext.length)}.png`;
        return {
            name: `${resource.name}${resource.ext}`,
            id: resource.source.uri[0],
            url: resource.source.uri,
            // eslint-disable-next-line @typescript-eslint/camelcase
            pack_format: resource.metadata.pack_format,
            description: resource.metadata.description,
            acceptingRange: getters.getAcceptMinecraftRangeByFormat(getResourcepackFormat(resource.metadata)),
            icon,
        };
    }
    function getResourcePackItemFromUrl([name, url]: [string, string]): ResourcePackItem {
        let resource = state.resource.directory[url];
        if (resource && isResourcePackResource(resource)) {
            return getResourcePackItem(resource);
        }
        return {
            name,
            url: [url],
            id: url,
            // eslint-disable-next-line @typescript-eslint/camelcase
            pack_format: -1,
            description: 'Unknown Pack',
            acceptingRange: '[*]',
            icon: unknownPack,
        };
    }

    /**
     * Unused resources
     */
    const unused = computed(() => state.resource.domains.resourcepacks.filter(r => r.source.uri
        .every(u => data.packs.every(p => p.id !== u)))
        .map(getResourcePackItem)
        .filter(isNonnull));

    /**
     * Add a new resource to the used list
     */
    function add(id: string) {
        let found = unused.value.find(m => m.id === id);
        if (found) { data.packs.push(found); }
    }

    /**
     * Remove a resource from used list
     */
    function remove(id: string) {
        data.packs = data.packs.filter(m => m.id !== id);
    }

    function insert(from: string, to: string) {
        const temp = data.packs.splice(data.packs.findIndex(p => p.id === from), 1);
        data.packs.splice(data.packs.findIndex(p => p.id === to), 0, ...temp);
        data.packs = [...data.packs];
    }

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        edit({
            resourcePacks: data.packs.map(r => r.name),
        });
        editInstance({ deployments: { resourcepacks: data.packs.map(r => r.id) } });
    }

    onMounted(() => {
        data.packs = Object.entries(getters.instance.deployments.resourcepacks)
            .map(getResourcePackItemFromUrl);
    });

    return {
        ...toRefs(data),
        unused,
        add,
        remove,
        commit,
        insert,
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
    onMounted(() => {
        refresh();
    });
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

/**
 * Contains some basic info of mod to display in UI.
 */
export interface ModItem {
    /**
     * Path on disk
     */
    path: string;
    /**
     * The identity of the mod
     */
    id: string;
    /**
     * Mod display name
     */
    name: string;
    /**
     * Mod version
     */
    version: string;
    description: string;
    /**
     * Mod icon url
     */
    icon: string;
    acceptMinecraft: string;
    /**
     * The backing resource
     */
    resource?: Resource;

    /**
     * The universal location of the mod
     */
    url: string;

    type: 'fabric' | 'forge' | 'liteloader' | 'unknown';
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
    const { state, getters } = useStore();
    const { editInstance } = useService('InstanceService');

    const data = reactive({
        mods: [] as ModItem[],
    });

    function getModItemFromModResource(resource: ForgeResource | FabricResource | LiteloaderResource): ModItem {
        if (resource.type === 'forge') {
            let meta = resource.metadata[0];
            let acceptMinecraft = `[${meta.version}]`;
            if (meta.acceptedMinecraftVersions) {
                acceptMinecraft = meta.acceptedMinecraftVersions;
            } else if (meta.loaderVersion) {
                acceptMinecraft = meta.loaderVersion;
            }
            return {
                path: resource.path,
                id: meta.modid,
                name: meta.displayName ?? meta.name ?? meta.modid,
                version: meta.version,
                description: meta.description ?? '',
                icon: unknownPack,
                acceptMinecraft,
                type: 'forge',
                url: resource.source.uri[0],
                resource,
            };
        }
        if (resource.type === 'fabric') {
            return {
                path: resource.path,
                id: resource.metadata.id,
                version: resource.metadata.version,
                name: resource.metadata.name ?? resource.metadata.id,
                description: resource.metadata.description ?? '',
                icon: '',
                acceptMinecraft: '[*]',
                type: 'fabric',
                url: resource.source.uri[0],
                resource,
            };
        }
        return {
            path: resource.path,
            id: resource.metadata.name,
            name: resource.metadata.name,
            version: resource.metadata.version ?? '',
            description: resource.metadata.description ?? '',
            icon: '',
            acceptMinecraft: `[${resource.metadata.mcversion}]`,
            type: 'liteloader',
            url: resource.source.uri[0],
            resource,
        };
    }

    function getModItemFromResource(resource: Resource) {
        if (isModResource(resource)) {
            return getModItemFromModResource(resource);
        }
        return undefined;
    }

    /**
     * Unused mod resources
     */
    const unusedMods = computed(
        () => state.resource.domains.mods
            .map(getModItemFromResource)
            .filter(isNonnull)
            .filter(mod => !data.mods.find(m => m.url === mod.url)),
    );

    /**
     * Commit the change for current mods setting
     */
    function commit() {
        editInstance({ deployments: { mods: data.mods.map(m => m.url) } });
    }

    onMounted(() => {
        data.mods = [
            ...getters.instance.deployments.mods.map(i => state.resource.directory[i])
                .map(getModItemFromResource)
                .filter(isNonnull),
        ];
    });

    onUnmounted(() => {
        commit();
    });

    return {
        ...toRefs(data),
        unusedMods,
        commit,
    };
}

export function useInstanceLogs() {
    const { state } = useStore();
    return {
        path: computed(() => state.instance.path),
        ...useServiceOnly('InstanceLogService', 'getCrashReportContent', 'getLogContent', 'listCrashReports', 'listLogs', 'removeCrashReport', 'removeLog', 'showCrash', 'showLog'),
    };
}
