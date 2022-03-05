import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'

Vue.use(Vuetify)

const vuetify = new Vuetify({
  icons: {
    iconfont: 'md',
    values: {
    },
  },
  theme: {
    dark: true,
    themes: {
      dark: {
        primary: colors.green,
        accent: colors.green.accent3,
      },
    },
  },
})

export default vuetify
