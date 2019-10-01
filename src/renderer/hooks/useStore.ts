import { Repo, Actions, Mutations } from 'universal/store';
import { inject, InjectionKey } from '@vue/composition-api';

export const STORE_SYMBOL: InjectionKey<Repo> = Symbol('Repo')

export function useStore(): Repo {
    const repo = inject(STORE_SYMBOL);
    if (!repo) throw new Error('Cannot find store. Maybe store not loaded?');
    return repo;
}

export function useAction<T extends keyof Actions>(key: T): (payload: Parameters<Required<Actions>[T]>[1]) => ReturnType<Required<Actions>[T]> {
    const { dispatch } = useStore();
    return (payload) => dispatch(key, payload);
}

export function useActions<T extends keyof Actions>(...keys: T[]): { [K in T]: (payload: Parameters<Required<Actions>[K]>[1] | void) => ReturnType<Required<Actions>[K]> } {
    const result: any = {};
    keys.forEach(k => { result[k] = useAction(k) });
    return result;
}

export function useMutation<T extends keyof Mutations>(key: T): (payload: Parameters<Required<Mutations>[T]>[1]) => void {
    const { commit } = useStore();
    return (payload) => commit(key, payload);
}

export function useMutations<T extends keyof Mutations>(...keys: T[]): { [K in T]: (payload: Parameters<Required<Mutations>[K]>[1] | void) => void } {
    const result: any = {};
    keys.forEach(k => { result[k] = useMutation(k) });
    return result;
}

