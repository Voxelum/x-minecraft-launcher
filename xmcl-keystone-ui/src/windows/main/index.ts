
import Vue, { defineComponent, h, provide, getCurrentInstance } from 'vue'
import VueI18n from 'vue-i18n'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
import VueObserveVisibility from 'vue-observe-visibility'
import Router from 'vue-router'
import Vuetify from 'vuetify'
import Vuex from 'vuex'
import { VuexServiceFactory } from '@/vuexServiceProxy'
import MainWindow from './App.vue'
import { createRouter } from './router'
import { createStore, kStore } from './store'
import vuetify from './vuetify'
import TextComponent from '@/components/TextComponent'
import { IssueHandler, kIssueHandlers, kServiceFactory, kSemaphores, useSemaphores, kAsyncRouteHandlers } from '@/composables'
import { kVuetify } from '@/composables/vuetify'
import 'virtual:windi.css'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kTaskManager, useTaskManager } from '@/composables/taskManager'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import messages from '@intlify/unplugin-vue-i18n/messages'
import '../../../locales/en.yaml'
import '../../../locales/zh-CN.yaml'

// to prevent the universal drop activated on self element dragging
document.addEventListener('dragstart', (e) => {
  if (e.dataTransfer?.effectAllowed === 'uninitialized') {
    e.dataTransfer!.effectAllowed = 'none'
  }
})

Vue.use(VueI18n, { bridge: true })
Vue.use(Router)
Vue.use(Vuex)
Vue.use(Vuetify)
Vue.use(VueObserveVisibility)

const i18n = castToVueI18n(
  createI18n(
    {
      legacy: false,
      locale: 'en',
      silentTranslationWarn: true,
      missingWarn: false,
      messages,
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

const router = createRouter()
Vue.use(i18n)

const app = new Vue(defineComponent({
  i18n,
  vuetify,
  router,
  setup() {
    const root = getCurrentInstance()!.proxy.$root
    Object.defineProperty(root, '$router', {
      value: new Proxy(root.$router, {
        get(target, key) {
          const prop = Reflect.get(target, key)
          if (prop instanceof Function) {
            return (prop as Function).bind(target)
          }
          return prop
        },
      }),
    })

    const store = createStore()
    provide(kStore, store)
    provide(kServiceFactory, new VuexServiceFactory(store))
    provide(kVuetify, vuetify.framework)
    provide(kSemaphores, useSemaphores())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kDialogModel, useDialogModel())
    provide(kTaskManager, useTaskManager())
    provide(kIssueHandlers, new IssueHandler())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())
    provide(kAsyncRouteHandlers, [])

    return () => h(MainWindow)
  },
}))

Vue.component('TextComponent', TextComponent)

app.$mount('#app')
