import i18n from 'universal/i18n';
import Vue from 'vue';
import VueParticles from 'vue-particles';
import select from '../../store';
import router from './router';
import './components';
import '../../useVuetify';
import start from '../../start';
import { Repo } from 'universal/store/store';
import VueRouter from 'vue-router';

import VueObserveVisibility from 'vue-observe-visibility';
import SkinView from '../../skin/SkinView.vue';
import TextComponent from '../../TextComponent';
import { toRefs } from '@vue/composition-api';

Vue.use(VueObserveVisibility);
Vue.component('text-component', TextComponent as any);
Vue.component('skin-view', SkinView);


Vue.use(VueParticles);

const store = select(['user', 'profile', 'version', 'resource']);

const gettersRefs = toRefs((store as Repo).getters as Repo['getters'] & { [key: string]: unknown; });

export function useStore(): Repo {
    return store as any as Repo;
}

export function useGetters() {
    return gettersRefs;
}

export function useRouter(): VueRouter {
    return router;
}

start({
    router,
    store,
    i18n: i18n(store),
});
