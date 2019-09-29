import { Repo } from 'universal/store';
import { inject, InjectionKey } from '@vue/composition-api';

export const STORE_SYMBOL: InjectionKey<Repo> = Symbol('Repo')

export default function useStore(): Repo {
    const repo = inject(STORE_SYMBOL);
    if (!repo) throw new Error('Cannot find store. Maybe store not loaded?');
    return repo;
}
