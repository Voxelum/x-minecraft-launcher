/* eslint-disable @typescript-eslint/no-use-before-define */
import unknownPack from '@/assets/unknown_pack.png';
import { basename } from '@/util/basename';
import { InstanceResource } from '@universal/entities/instance';
import { isResourcePackResource, Resource } from '@universal/entities/resource';
import { computed, onMounted, ref, Ref, watch } from '@vue/composition-api';
import { PackMeta } from '@xmcl/resourcepack';
import { useService, useStore } from '.';
import { useBusy } from './useSemaphore';

export interface ResourcePackItem extends PackMeta.Pack {
    /**
     * The resource pack file path
     */
    path: string;
    /**
     * The display name of the resource pack
     */
    name: string;
    /**
     * The id in resourcepack array in gamesetting file
     */
    id: string;
    /**
     * The url of the resourcepack
     */
    url: string[];
    acceptingRange: string;
    /**
     * Icon url
     */
    icon: string;

    /**
     * The resource associate with the resourcepack item.
     * If it's undefined. Then this resource cannot be found.
     */
    resource?: Resource;
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
    const { state, getters } = useStore();
    const { edit } = useService('InstanceGameSettingService');

    const loading = useBusy('mountResourcepacks');

    const instanceResourcePacks = computed(() => state.instance.resourcepacks);
    /**
     * The resource pack name array.
     * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
     * It should be something like ['file/pack.zip', 'vanilla']
     */
    const enabledResourcePackNames: Ref<string[]> = ref([]);
    /**
     * Enabled pack item
     */
    const enabled = computed(() => enabledResourcePackNames.value.map(getResourcePackItemFromGameSettingName));
    const storage = computed(() => instanceResourcePacks.value.map(getResourcePackItemFromInstanceResource)
        .concat(state.resource.domains.resourcepacks
            .filter(r => instanceResourcePacks.value.every(p => p.hash !== r.hash))
            .map(getResourcePackItem)));
    /**
     * Disabled pack item
     */
    const disabled = computed(() => storage.value.filter((item) => enabledResourcePackNames.value.indexOf(item.id) === -1));

    const modified = computed(() => {
        if (enabledResourcePackNames.value.length !== state.instance.settings.resourcePacks.length) {
            return true;
        }
        return enabledResourcePackNames.value.every((v, i) => state.instance.settings.resourcePacks[i] !== v);
    });

    function getResourcepackFormat(meta: any) {
        return meta ? meta.format ?? meta.pack_format : 3;
    }
    function getResourcePackItem(resource: Resource<PackMeta.Pack>): ResourcePackItem {
        const icon = `${resource.path.substring(0, resource.path.length - resource.ext.length)}.png`;
        return {
            path: resource.path,
            name: basename(resource.path),
            id: `file/${basename(resource.path)}`,
            url: resource.source.uri,
            pack_format: resource.metadata.pack_format,
            description: resource.metadata.description,
            acceptingRange: getters.getAcceptMinecraftRangeByFormat(getResourcepackFormat(resource.metadata)),
            icon,

            resource: Object.freeze(resource),
        };
    }
    function getResourcePackItemFromInstanceResource(resource: InstanceResource): ResourcePackItem {
        if (resource && isResourcePackResource(resource)) {
            return getResourcePackItem(resource);
        }
        return {
            path: resource.path,
            name: resource.filePath,
            url: [resource.source.uri[0]],
            id: `file/${basename(resource.filePath)}`,
            pack_format: -1,
            description: 'Unknown Pack',
            acceptingRange: '[*]',
            icon: unknownPack,

            resource: Object.freeze(resource),
        };
    }
    function getResourcePackItemFromGameSettingName(resourcePackName: string): ResourcePackItem {
        if (resourcePackName === 'vanilla') {
            return {
                path: '',
                acceptingRange: '[*]',
                icon: unknownPack,
                name: 'Default',
                description: 'The default look and feel of Minecraft',
                pack_format: 0,
                id: 'vanilla',
                url: [],
            };
        }
        let foundedItem = storage.value.find((p) => p.id === resourcePackName || p.id === `file/${resourcePackName}`);
        if (foundedItem) {
            return foundedItem;
        }

        return {
            path: '',
            name: resourcePackName,
            acceptingRange: 'unknown',
            icon: unknownPack,
            description: '',
            pack_format: -1,
            id: `file/${resourcePackName}`,
            url: [],
        };
    }

    /**
     * Add a new resource to the enabled list
     */
    function add(id: string, to?: string) {
        if (typeof to === 'undefined') {
            let found = disabled.value.find(m => m.id === id);
            if (found) {
                enabledResourcePackNames.value.push(id);
            }
        } else {
            let index = enabledResourcePackNames.value.indexOf(to);
            if (index !== -1) {
                enabledResourcePackNames.value.splice(index, 0, id);
                enabledResourcePackNames.value = [...enabledResourcePackNames.value];
            } else {
                enabledResourcePackNames.value.push(id);
            }
        }
    }

    /**
     * Remove a resource from enabled list
     */
    function remove(id: string) {
        if (id === 'vanilla') {
            return;
        }
        enabledResourcePackNames.value = enabledResourcePackNames.value.filter((name) => name !== id);
    }

    function insert(from: string, to: string) {
        const packs = enabledResourcePackNames.value;
        const temp = packs.splice(packs.findIndex(p => p === from), 1);
        packs.splice(packs.findIndex(p => p === to), 0, ...temp);
        enabledResourcePackNames.value = [...packs];
    }

    /** 
     * Commit the change for current mods setting 
     */
    function commit() {
        edit({ resourcePacks: [...enabledResourcePackNames.value].reverse() });
    }

    const settingedResourcePacks = computed(() => state.instance.settings.resourcePacks);
    watch(settingedResourcePacks, (packs) => {
        let arr = [...packs.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))];
        if (arr.indexOf('vanilla') === -1) {
            arr.unshift('vanilla');
        }
        enabledResourcePackNames.value = arr.reverse();
    });
    onMounted(() => {
        let arr = [...settingedResourcePacks.value.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))];
        if (arr.indexOf('vanilla') === -1) {
            arr.unshift('vanilla');
        }
        enabledResourcePackNames.value = arr.reverse();
    });

    return {
        modified,
        enabled,
        disabled,
        add,
        remove,
        commit,
        insert,
        loading,
    };
}
