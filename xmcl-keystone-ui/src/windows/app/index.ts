import TextComponent from '@/components/TextComponent'
import { kServiceFactory, useServiceFactory } from '@/composables'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import Vue, { defineComponent, h, provide } from 'vue'
import App from './App.vue'
import Context from './Context'

// to prevent the universal drop activated on self element dragging
document.addEventListener('dragstart', (e) => {
  if (e.dataTransfer?.effectAllowed === 'uninitialized') {
    e.dataTransfer!.effectAllowed = 'none'
  }
})

const app = new Vue(defineComponent({
  i18n,
  vuetify,
  setup() {
    provide(kServiceFactory, useServiceFactory())
    provide(kDialogModel, useDialogModel())
    provide(kSWRVConfig, useSWRVConfig())

    return () => h(Context, [h(App)])
  },
}))

Vue.component('TextComponent', TextComponent)

app.$mount('#app')

window.addEventListener('message', (e) => {
  windowController.focus()
})
