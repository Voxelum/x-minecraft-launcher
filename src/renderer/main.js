import Vue from 'vue';

<<<<<<< HEAD
import App from './App'
import store from './store'
import i18n from './i18n'
import launcher from './launcher'
=======
>>>>>>> 80c39a12b27d9305dba84183e86f9655b3781a0e

import Vuetify from 'vuetify';
import App from './App.vue';
import store from './store';
import i18n from './i18n';


if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false

<<<<<<< HEAD
launcher.fetchAll().then(modules => {
  console.log('moduleFetched')
  for (var id in modules) {
    if (modules.hasOwnProperty(id)) {
      var m = modules[id];
      console.log(m)
      // update vuex store instance by:
      // operate  v.$store.state?
    }
  }
  console.log(v.$store.state)
}, err => {
  console.error(err)
})

//TODO load initialize all modules by call main-process
=======
// TODO load initialize all modules by call main-process
>>>>>>> 80c39a12b27d9305dba84183e86f9655b3781a0e


/* eslint-disable no-new */
Vue.use(Vuetify);
new Vue({
    components: { App },
    store,
    i18n,
    template: '<App/>',
}).$mount('#app')
