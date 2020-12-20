import unknownPack from '@/assets/unknown_pack.png';
import { CurseforgeModpackResource, ForgeResource, LiteloaderResource, ResourcePackResource, SaveResource, FabricResource } from '@universal/entities/resource';
import { requireTrue } from '@universal/util/assert';
import { computed, Ref, ref } from '@vue/composition-api';
import { useServiceOnly } from './useService';
import { useStore } from './useStore';

export function useResourceOperation() {
    const { parseAndImportResourceIfAbsent, removeResource } = useServiceOnly('ResourceService', 'parseAndImportResourceIfAbsent', 'removeResource');
    return {
        removeResource,
        importResource: parseAndImportResourceIfAbsent,
    };
}

/* eslint-disable import/export */
export function useResource(domain: 'mods'): {
    resources: Ref<Array<ForgeResource | LiteloaderResource | FabricResource>>;
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

export function useCurseforgeImport() {
    return useServiceOnly('InstanceIOService', 'importCurseforgeModpack');
}
