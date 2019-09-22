import Vue, { ComponentOptions } from 'vue';
import VueCompositionApi from '@vue/composition-api';

Vue.use(VueCompositionApi);

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'));
}
Vue.config.productionTip = false;

export default function (option: ComponentOptions<Vue>) {
    const App = require('./App').default;
    const vue = new Vue({
        ...option,
        render: h => h(App),
    });
    Vue.prototype.$repo = (vue as any).$store;
    vue.$mount('#app');
}
