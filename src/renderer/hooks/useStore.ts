import { computed, inject } from '@vue/composition-api';
import { BuiltinServices } from 'main/service';
import { SERVICES_KEY, STORE_KEY } from 'renderer/constant';
import { RootCommit, Store } from 'universal/store';

export function useStore(): Store & { services: BuiltinServices } {
    const repo = inject(STORE_KEY);
    if (!repo) throw new Error('Cannot find Store. Maybe store not loaded?');
    const seriv = inject(SERVICES_KEY);
    if (!seriv) throw new Error('Cannot find Services. Maybe it is not loaded?');
    return Object.assign(repo, { services: seriv });
}

export function useBusy(semaphore: string | Function) {
    const key = typeof semaphore === 'function' ? semaphore.name : semaphore;
    const { state } = useStore();
    return computed(() => state.semaphore[key] > 0);
}

export function useBaseService() {
    const { services } = useStore();
    return {
        showItemInDirectory: services.BaseService.showItemInDirectory,
        openInBrowser: services.BaseService.openInBrowser,
        openDirectory: services.BaseService.openDirectory,
    };
}

export function useMutation<T extends keyof RootCommit>(key: T): (payload: Parameters<Required<RootCommit>[T]>[1]) => void {
    const { commit } = useStore();
    return payload => commit(key, payload);
}

export function useMutations<T extends keyof RootCommit>(...keys: T[]): { [K in T]: (payload: Parameters<Required<RootCommit>[K]>[1] | void) => void } {
    const result: any = {};
    keys.forEach((k) => { result[k] = useMutation(k); });
    return result;
}
