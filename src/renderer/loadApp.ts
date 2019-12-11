import VueCompositionApi, { createElement as h, provide } from '@vue/composition-api';
import Vue, { ComponentOptions, VueConstructor } from 'vue';
import { I18N_KEY, ROUTER_KEY, STORE_KEY } from './constant';
import provideElectron from './providers/provideElectron';
import provideServiceProxy from './providers/provideServiceProxy';

Vue.use(VueCompositionApi);

Vue.config.productionTip = false;

export default function app(entryPage: VueConstructor<Vue>, option: ComponentOptions<Vue>) {
    const vue = new Vue({
        ...option,
        setup() {
            provideElectron();
            provideServiceProxy();
            if (option.store) {
                provide(STORE_KEY, option.store);
            }
            if (option.router) {
                provide(ROUTER_KEY, option.router);
            }
            if (option.i18n) {
                provide(I18N_KEY, option.i18n);
            }
            return () => h(entryPage);
        },
    });
    vue.$mount('#app');
}
