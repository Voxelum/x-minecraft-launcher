import locales from '@/assets/locales';
import { I18N_KEY, ROUTER_KEY } from '@/constant';
import provideElectron from '@/providers/provideElectron';
import provideServiceProxy from '@/providers/provideServiceProxy';
import provideVueI18n from '@/providers/provideVueI18n';
import provideVuexStore from '@/providers/provideVuexStore';
import SkinView from '@/skin/SkinView.vue';
import TextComponent from '@/TextComponent';
import Vuetify from 'vuetify';
import colors from 'vuetify/es5/util/colors';
import 'vuetify/dist/vuetify.css';
import '@/assets/google.font.css';

import Vue, { VueConstructor as App } from 'vue';
import VueCompositionApi, { createElement as h, provide } from '@vue/composition-api';
import VueObserveVisibility from 'vue-observe-visibility';
import VueParticles from 'vue-particles';
import Router from 'vue-router';
import components from './components';
import MainWindow from './MainWindow.vue';
import CurseforgeIcon from './components/CurseforgeIcon.vue';
import router from './router';

function configApp(app: App) {
    app.config.productionTip = false;
    app.use(Vuetify, {
        icons: {
            curseforge: {
                component: CurseforgeIcon,
            },
        },
        theme: {
            primary: colors.green,
            // secondary: colors.green,
            accent: colors.green.accent3,
        },
    });
    app.use(Router);
    app.use(VueCompositionApi);
    app.use(VueObserveVisibility);
    app.use(VueParticles);
    app.component('text-component', TextComponent);
    app.component('skin-view', SkinView);
    components.forEach(([name, comp]) => {
        app.component(name, comp);
    });
}
function startApp() {
    const i18n = provideVueI18n('en', locales);
    const app = new Vue({
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
    app.$mount('#app');
}


configApp(Vue);
startApp();
