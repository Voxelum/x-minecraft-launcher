import Vue from 'vue';
import MuseUI from 'muse-ui';
import Vuetify from 'vuetify';
import 'muse-ui/dist/muse-ui.css'

import App from './App.vue'
import store from './store'
import launcher from './launcher'
import i18n from './i18n';

Vue.use(MuseUI);
Vue.use(Vuetify);
if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}

Vue.config.productionTip = false

store().then(s =>
    new Vue({
        components: { App },
        store: s,
        i18n,
        template: '<App/>',
    }).$mount('#app'),
)

