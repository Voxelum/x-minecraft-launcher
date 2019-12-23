import VueCompositionApi, { createElement as h, provide } from '@vue/composition-api';
import Vue from 'vue';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import locales from 'static/locales';

import SkinView from '@/skin/SkinView.vue';
import TextComponent from '@/TextComponent';
import '@/useVuetify';
import './components';
import MainWindow from './MainWindow.vue';
import router from './router';
import provideElectron from '@/providers/provideElectron';
import provideServiceProxy from '@/providers/provideServiceProxy';
import provideVuexStore from '@/providers/provideVuexStore';
import { ROUTER_KEY, I18N_KEY } from '@/constant';
import provideVueI18n from '@/providers/provideVueI18n';

Vue.config.productionTip = false;

Vue.use(VueCompositionApi);
Vue.use(VueObserveVisibility);
Vue.use(VueParticles);
Vue.component('text-component', TextComponent);
Vue.component('skin-view', SkinView);
const i18n = provideVueI18n('en', locales);

const vue = new Vue({
    router,
    i18n,
    setup() {
        provideElectron();
        provideServiceProxy();
        const store = provideVuexStore();
        provide(I18N_KEY, i18n);
        store.watch((state) => state.setting.locale, (newValue: string, oldValue: string) => {
            console.log(`Locale changed ${oldValue} -> ${newValue}`);
            i18n.locale = newValue;
        });
        provide(ROUTER_KEY, router);
        return () => h(MainWindow);
    },
});

vue.$mount('#app');
