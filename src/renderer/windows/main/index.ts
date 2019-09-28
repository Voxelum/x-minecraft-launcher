import { toRefs } from '@vue/composition-api';
import { Repo } from 'universal/store';
import Vue from 'vue';
import VueI18n from 'vue-i18n';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import VueRouter from 'vue-router';
import SkinView from '../../skin/SkinView.vue';
import start from '../../start';
import select from '../../store';
import TextComponent from '../../TextComponent';
import '../../useVuetify';
import './components';
import i18n from './i18n';
import router from './router';


Vue.use(VueObserveVisibility);
Vue.component('text-component', TextComponent as any);
Vue.component('skin-view', SkinView);


Vue.use(VueParticles);

const store = select(['user', 'profile', 'version', 'resource']);
const _i18n = i18n(store);
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

export function useI18n(): VueI18n & { t(): string } {
    return _i18n;
}
export function l(strings: TemplateStringsArray) {
    return _i18n.t(strings[0], arguments);
}


start({
    router,
    store,
    i18n: _i18n,
});
