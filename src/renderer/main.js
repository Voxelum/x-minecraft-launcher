import Vue from 'vue';
import App from './App'
import store from './store'
import launcher from './launcher'
// import Vuetify from 'vuetify';
import i18n from './i18n';


if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false

launcher.fetchAll().then((modules) => {
    console.log('moduleFetched')
    for (const id in modules) {
        if (modules.hasOwnProperty(id)) {
            let m = modules[id];
            console.log(m)
            // update vuex store instance by:
            // operate  v.$store.state?
        }
    }
    console.log(v.$store.state)
}, (err) => {
    console.error(err)
})

// TODO load initialize all modules by call main-process

/* eslint-disable no-new */
// Vue.use(Vuetify);
new Vue({
    components: { App },
    store,
    i18n,
    template: '<App/>',
}).$mount('#app')
