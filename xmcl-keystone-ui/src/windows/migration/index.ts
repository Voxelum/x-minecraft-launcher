import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import { usePreferredDark } from '@vueuse/core'
import 'virtual:uno.css'
import Vue, { h } from 'vue'
import App from './App.vue'

const app = new Vue(defineComponent({
  vuetify,
  i18n,
  setup(props, context) {
    const preferDark = usePreferredDark()
    const updateTheme = (theme: string) => {
      if (theme === 'system') {
        vuetify.framework.theme.dark = preferDark.value
      } else if (theme === 'dark') {
        vuetify.framework.theme.dark = true
      } else if (theme === 'light') {
        vuetify.framework.theme.dark = false
      }
    }
    updateTheme('dark')

    return () => h(App)
  },
}))

app.$mount('#app')
