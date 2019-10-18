import unknownPack from '@/assets/unknown_pack.png';
import { computed, onMounted, Ref, ref } from "@vue/composition-api";
import { CurseforgeModpackResource, ForgeResource, ImportOption, LiteloaderResource, ResourcePackResource } from "universal/store/modules/resource";
import { useStore } from "./useStore";

export function useResourceOperation() {
    const { getters, dispatch } = useStore();
    return {
        queryResource: getters.queryResource,
        getResource: getters.getResource,
        importResource(option: ImportOption) {
            return dispatch('importResource', option);
        },
        removeResource(id: string) {
            return dispatch('removeResource', id);
        },
    };
}

export function useResource(domain: 'mods'): {
    resourcesTree: Ref<{ [hash: string]: ForgeResource | LiteloaderResource }>;
    resources: Ref<Array<ForgeResource | LiteloaderResource>>
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'resourcepacks'): {
    resourcesTree: Ref<{ [hash: string]: ResourcePackResource }>;
    resources: Ref<Array<ResourcePackResource>>
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'modpacks'): {
    resourcesTree: Ref<{ [hash: string]: CurseforgeModpackResource }>;
    resources: Ref<Array<CurseforgeModpackResource>>
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: string) {
    const { state } = useStore();
    const resourcesTree = computed(() => state.resource.domains[domain]);
    const resources = computed(() => Object.values(state.resource.domains[domain]))
    return {
        ...useResourceOperation(),
        resourcesTree,
        resources,
    };
}

function getResourcepackFormat(meta: any) {
    return meta ? meta.format || meta.pack_format : 3;
}

export function useResourcePackResource(resource: ResourcePackResource) {
    const { getters } = useStore();
    const metadata = computed(() => resource.metadata);
    console.log(resource);
    const icon = computed(() => resource.metadata.icon || unknownPack);
    const acceptedRange = computed(() => getters.getAcceptMinecraftRangeByFormat(getResourcepackFormat(resource.metadata)));

    return {
        metadata,
        icon,
        acceptedRange,
    }
}

export function useCurseforgeImport() {
    const { dispatch } = useStore();
    return {
        importCurseforgeModpack(payload: { profile: string; path: string; }) {
            return dispatch('importCurseforgeModpack', payload);
        },
    }
}

export function useForgeModResource(resource: ForgeResource) {
    const { dispatch } = useStore();
    const metadata = computed(() => resource.metadata[0]);
    const icon = ref(unknownPack);
    const acceptedRange = computed(() => {
        if (metadata.value.acceptedMinecraftVersions) {
            return metadata.value.acceptedMinecraftVersions;
        }
        if (metadata.value.mcversion) {
            const mcversion = metadata.value.mcversion;
            if (/^\[.+\]$/.test(mcversion)) {
                return mcversion;
            }
            return `[${mcversion}]`;
        }
        return '[*]';
    });
    onMounted(() => {
        readLogo();
    });

    function readLogo() {
        if ('missing' in resource) {
            icon.value = unknownPack;
        } else {
            dispatch('readForgeLogo', resource.hash).then((i) => {
                if (typeof i === 'string' && i !== '') {
                    icon.value = `data:image/png;base64, ${i}`;
                } else {
                    icon.value = unknownPack;
                }
            });
        }
    }
    return {
        icon,
        metadata,
        acceptedRange,
    }
}