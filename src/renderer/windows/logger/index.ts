import '@/useVuetify';
import VueCompositionApi, { createElement as h } from '@vue/composition-api';
import Vue from 'vue';
import provideElectron from '@/providers/provideElectron';
import Logger from './Logger.vue';

Vue.config.productionTip = false;

Vue.use(VueCompositionApi);

const vue = new Vue({
    setup() {
        provideElectron();
        return () => h(Logger);
    },
});

vue.$mount('#app');
