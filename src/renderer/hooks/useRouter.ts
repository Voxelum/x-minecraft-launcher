import VueRouter from 'vue-router';
import { inject, InjectionKey } from '@vue/composition-api';

export const ROUTER_SYMBOL: InjectionKey<VueRouter> = Symbol('VueRouter')

export function useRouter(): VueRouter {
    const router = inject(ROUTER_SYMBOL);
    if (!router) throw new Error('Cannot find router. Maybe router not loaded?');
    return router;
}
