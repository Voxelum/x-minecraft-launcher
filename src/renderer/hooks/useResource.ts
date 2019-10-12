import { useStore } from "./useStore";
import { ResourceModule } from "universal/store/modules/resource";
import { computed, Ref } from "@vue/composition-api";

export function useResourceOperation() {
    const { getters, dispatch } = useStore();
    return {
        queryResource: getters.queryResource,
        getResource: getters.getResource,
        importResource(option: ResourceModule.ImportOption) {
            return dispatch('importResource', option);
        },
        removeResource(id: string) {
            return dispatch('removeResource', id);
        },
    };
}

export function useResource(domain: 'mods'): {
    resourcesTree: Ref<{ [hash: string]: ResourceModule.ForgeResource | ResourceModule.LiteloaderResource }>;
    resources: Ref<Array<ResourceModule.ForgeResource | ResourceModule.LiteloaderResource>>
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'resourcepacks'): {
    resourcesTree: Ref<{ [hash: string]: ResourceModule.ResourcePackResource }>;
    resources: Ref<Array<ResourceModule.ResourcePackResource>>
} & ReturnType<typeof useResourceOperation>;
export function useResource(domain: 'modpacks'): {
    resourcesTree: Ref<{ [hash: string]: ResourceModule.CurseforgeModpackResource }>;
    resources: Ref<Array<ResourceModule.CurseforgeModpackResource>>
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
