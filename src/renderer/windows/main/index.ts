import { I18N_KEY, ROUTER_KEY } from '@/constant';
import locales from '@/assets/locales';
import provideElectron from '@/providers/provideElectron';
import provideServiceProxy from '@/providers/provideServiceProxy';
import provideVueI18n from '@/providers/provideVueI18n';
import provideVuexStore from '@/providers/provideVuexStore';
import SkinView from '@/skin/SkinView.vue';
import TextComponent from '@/TextComponent';
import '@/useVuetify';
import VueCompositionApi, { createElement as h, provide } from '@vue/composition-api';
import Vue from 'vue';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import './components';
import MainWindow from './MainWindow.vue';
import router from './router';


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
        provide(ROUTER_KEY, new Proxy(router, {
            get(target, key) {
                const prop = Reflect.get(target, key);
                if (prop instanceof Function) {
                    return (prop as Function).bind(target);
                }
                return prop;
            },
        }));
        return () => h(MainWindow);
    },
});

vue.$mount('#app');
