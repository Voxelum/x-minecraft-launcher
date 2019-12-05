import VueRouter from 'vue-router';
import { inject } from '@vue/composition-api';
import { ROUTER_KEY } from 'renderer/constant';

export function useRouter(): VueRouter {
    const router = inject(ROUTER_KEY);
    if (!router) throw new Error('Cannot find router. Maybe router not loaded?');
    return router;
}
