import { toRefs } from '@vue/composition-api';
import i18n from 'universal/i18n';
import { Repo } from 'universal/store';
import Vue from 'vue';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import VueRouter from 'vue-router';
import SkinView from '../../skin/SkinView.vue';
import start from '../../start';
import select from '../../store';
import TextComponent from '../../TextComponent';
import '../../useVuetify';
import './components';
import router from './router';


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
