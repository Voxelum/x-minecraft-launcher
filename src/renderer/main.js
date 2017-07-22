import Vue from 'vue';
import MuseUI from 'muse-ui';
import 'muse-ui/dist/muse-ui.css'

import App from './App.vue'
import store from './store'
import launcher from './launcher'
import i18n from './i18n';

Vue.use(MuseUI);
if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false
let v
launcher.fetchAll().then((modules) => {
    for (const id in modules) {
        if (modules.hasOwnProperty(id)) {
            v.$store.commit(`${id}/$reload`, modules[id])
        }
    }
}, (err) => {
    console.error(err)
})

// TODO load initialize all modules by call main-process

/* eslint-disable no-new */
// Vue.use(Vuetify);
v = new Vue({
    components: { App },
    store,
    i18n,
    template: '<App/>',
}).$mount('#app')
