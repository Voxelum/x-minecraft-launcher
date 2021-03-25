// import 'vuetify/dist/vuetify.css';
import '/@/assets/google.font.css'
import { I18N_KEY } from '/@/constant'
import provideElectron from '/@/providers/provideElectron'
import VueCompositionApi, { h, provide } from '@vue/composition-api'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import 'vuetify/dist/vuetify.min.css'
import Vuetify from 'vuetify'
import colors from 'vuetify/es5/util/colors'
import Setup from './Setup.vue'

Vue.config.productionTip = false

Vue.use(VueCompositionApi)
Vue.use(Vuetify, {
  theme: {
    primary: colors.green,
    // secondary: colors.green,
    accent: colors.green.accent3,
  },
})

Vue.use(VueI18n)

const i18n = new VueI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      title: 'Welcome to KeyStone UI. Before start, we need you to setup the root directory of game data',
      defaultPath: 'Default Path',
      path: 'Current Path',
      browse: 'Browse',
      confirm: 'Start',
    },
    'zh-CN': {
      title: '欢迎使用 KeyStone UI。在开始前，需要您先设置游戏数据存储目录',
      defaultPath: '默认位置',
      path: '当前位置',
      browse: '浏览',
      confirm: '开始',
    },
  },
  missing: () => {
    // handle translation missing
  },
  silentTranslationWarn: true,
})
const vue = new Vue({
  i18n,
  setup () {
    provideElectron()
    provide(I18N_KEY, i18n)
    return () => h(Setup)
  },
})

vue.$mount('#app')
