import VueCompositionApi, { createElement as h, provide } from '@vue/composition-api';
import Vue, { ComponentOptions } from 'vue';
import { I18N_KEY, ROUTER_KEY, STORE_KEY } from './constant';
import provideElectron from './providers/provideElectron';
import provideServiceProxy from './providers/provideServiceProxy';

Vue.use(VueCompositionApi);

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
            return () => h(App);
        },
    });
    vue.$mount('#app');
}
