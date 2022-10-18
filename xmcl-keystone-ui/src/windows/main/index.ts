import {
  Camera, Color, LinearFilter, Mesh,
  PlaneGeometry, RGBAFormat, Scene,
  ShaderMaterial,
  TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three'
import Vue, { defineComponent, h, provide } from 'vue'
import VueI18n from 'vue-i18n'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
import VueObserveVisibility from 'vue-observe-visibility'
import Router from 'vue-router'
import Vuetify from 'vuetify'
import Vuex from 'vuex'
import { VuexServiceFactory } from '../../vuexServiceProxy'
import MainWindow from './App.vue'
import { createRouter } from './router'
import { createStore, kStore } from './store'
import vuetify from './vuetify'
import TextComponent from '/@/components/TextComponent'
import { IssueHandler, kIssueHandlers, kServiceFactory, kSemaphores, useSemaphores, kAsyncRouteHandlers } from '/@/composables'
import { kVuetify } from '/@/composables/vuetify'
import 'virtual:windi.css'
import { kDialogModel, useDialogModel } from './composables/dialog'
import { kNotificationQueue, useNotificationQueue } from './composables/notifier'
import { kServerStatusCache, useServerStatusCache } from './composables/serverStatus'
import { kTaskManager, useTaskManager } from './provideTaskProxy'
import { kExceptionHandlers, useExceptionHandlers } from '/@/composables/exception'

// TODO: fix this after refactor halo
window.THREE = {
  LinearFilter,
  WebGLRenderTarget,
  RGBAFormat,
  Vector3,
  Color,
  Vector2,
  WebGLRenderer,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Mesh,
  PlaneGeometry,
  Camera,
} as any

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
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

const router = createRouter()

const app = new Vue(defineComponent({
  i18n,
  vuetify,
  router,
  setup() {
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
