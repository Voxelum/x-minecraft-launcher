import { computed, Ref, ref } from '@vue/composition-api';
import { CurseforgeModpackResource, ForgeResource, LiteloaderResource, ResourcePackResource, SaveResource } from '@universal/store/modules/resource';
import { requireTrue } from '@universal/util';
import unknownPack from '@/assets/unknown_pack.png';
import { useStore } from './useStore';

export function useResourceOperation() {
    const { getters, services } = useStore();
    return {
        queryResource: getters.queryResource,
        importResource: services.ResourceService.importUnknownResource,
        removeResource: services.ResourceService.removeResource,
        getResource: getters.getResource,
    };
}

/* eslint-disable import/export */
export function useResource(domain: 'mods'): {
    resources: Ref<Array<ForgeResource | LiteloaderResource>>;
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'resourcepacks'): {
    resources: Ref<Array<ResourcePackResource>>;
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'modpacks'): {
    resources: Ref<Array<CurseforgeModpackResource>>;
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'saves'): {
    resources: Ref<Array<SaveResource>>;
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: string) {
    const { state } = useStore();
    const resources = computed(() => state.resource.domains[domain]);
    return {
        ...useResourceOperation(),
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
    };
}

export function useCurseforgeImport() {
    const { services } = useStore();
    return {
        importCurseforgeModpack: services.InstanceService.importInstanceFromCurseforgeModpack,
    };
}

export function useForgeModResource(resource: ForgeResource) {
    requireTrue(resource.type === 'forge');
    const metadata = computed(() => (resource.metadata || [])[0] || {});
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
        return 'unknown';
    });
    const acceptLoaderRange = computed(() => (metadata.value as any).loaderVersion as string || 'unknown');
    return {
        icon,
        metadata,
        acceptedRange,
        acceptLoaderRange,
    };
}
