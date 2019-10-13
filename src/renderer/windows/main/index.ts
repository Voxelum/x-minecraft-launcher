import createStore from '@/store';
import Vue from 'vue';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import SkinView from '@/skin/SkinView.vue';
import app from '@/loadApp';
import TextComponent from '@/TextComponent';
import '@/useVuetify';
import './components';
import i18n from './i18n';
import router from './router';

Vue.use(VueObserveVisibility);
Vue.use(VueParticles);
Vue.component('text-component', TextComponent as any);
Vue.component('skin-view', SkinView);

const store = createStore([]);
const _i18n = i18n(store);

app({
    router,
    store,
    i18n: _i18n,
});
