import Vue, { ComponentOptions } from 'vue';
import VueCompositionApi, { provide, createElement as h } from '@vue/composition-api';
import { STORE_SYMBOL } from './hooks/useStore';
import { ROUTER_SYMBOL } from './hooks/useRouter';

Vue.use(VueCompositionApi);

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'));
}
Vue.config.productionTip = false;

export default function (option: ComponentOptions<Vue>) {
    const App = require('./App').default;
    const vue = new Vue({
        ...option,
        setup() {
            provide(STORE_SYMBOL, option.store);
            provide(ROUTER_SYMBOL, option.router);
            return () => h(App)
        },
    });
    Vue.prototype.$repo = (vue as any).$store;
    vue.$mount('#app');
}
