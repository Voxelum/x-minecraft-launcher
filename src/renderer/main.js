import Vue from 'vue';

import App from './App.vue'
import store from './store'
import launcher from './launcher'
import i18n from './i18n';

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}

Vue.config.productionTip = false

/* eslint-disable no-new */
// Vue.use(Vuetify);
new Vue({
    components: { App },
    store,
    i18n,
    template: '<App/>',
}).$mount('#app')
