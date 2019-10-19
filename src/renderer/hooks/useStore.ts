import { Store, RootDispatch, RootCommit } from 'universal/store';
import { inject, InjectionKey } from '@vue/composition-api';

export const STORE_SYMBOL: InjectionKey<Store> = Symbol('Repo')

export function useStore(): Store {
    const repo = inject(STORE_SYMBOL);
    if (!repo) throw new Error('Cannot find store. Maybe store not loaded?');
    return repo;
}

export function useAction<T extends keyof RootDispatch>(key: T): (payload: Parameters<RootDispatch[T]>[1]) => ReturnType<RootDispatch[T]> {
    const { dispatch } = useStore();
    return (payload) => dispatch(key, payload) as any;
}

export function useActions<T extends keyof RootDispatch>(...keys: T[]): { [K in T]: (payload: Parameters<Required<RootDispatch>[K]>[1] | void) => ReturnType<Required<RootDispatch>[K]> } {
    const result: any = {};
    keys.forEach(k => { result[k] = useAction(k) });
    return result;
}

export function useMutation<T extends keyof RootCommit>(key: T): (payload: Parameters<Required<RootCommit>[T]>[1]) => void {
    const { commit } = useStore();
    return (payload) => commit(key, payload);
}

export function useMutations<T extends keyof RootCommit>(...keys: T[]): { [K in T]: (payload: Parameters<Required<RootCommit>[K]>[1] | void) => void } {
    const result: any = {};
    keys.forEach(k => { result[k] = useMutation(k) });
    return result;
}

