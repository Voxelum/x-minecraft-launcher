import i18n from 'universal/i18n';
import Vue from 'vue';
import VueParticles from 'vue-particles';
import select from '../../store';
import router from './router';
import './components';

import start from '../../start';
import { Repo } from 'universal/store/store';
import VueRouter from 'vue-router';

Vue.use(VueParticles);

const store = select(['user', 'profile', 'version', 'resource']);

export function useStore(): Repo {
    return store as any as Repo;
}

export function useRouter(): VueRouter {
    return router;
}

start({
    router,
    store,
    i18n: i18n(store),
});
