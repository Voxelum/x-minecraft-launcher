import Vue, { ComponentOptions } from 'vue';
import VueCompositionApi, { provide, createElement as h } from '@vue/composition-api';
import { STORE_KEY, ROUTER_KEY, I18N_KEY } from './constant';
import provideElectron from './providers/provideElectron';
import provideServiceProxy from './providers/provideServiceProxy';

Vue.use(VueCompositionApi);

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'));
}
Vue.config.productionTip = false;

export default function app(option: ComponentOptions<Vue>) {
    const App = require('./App').default;
    const vue = new Vue({
        ...option,
        setup() {
            provideElectron();
            provideServiceProxy();
            provide(STORE_KEY, option.store);
            provide(ROUTER_KEY, option.router);
            provide(I18N_KEY, option.i18n);
            return () => h(App)
        },
    });
    Vue.prototype.$repo = (vue as any).$store;
    vue.$mount('#app');
}
