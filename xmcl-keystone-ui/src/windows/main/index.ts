import Vue, { computed, defineComponent, h, provide, watch } from 'vue'
import { BaseServiceKey } from '@xmcl/runtime-api'
import {
  Camera, Color, LinearFilter, Mesh,
  PlaneGeometry, RGBAFormat, Scene,
  ShaderMaterial,
  TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three'
import VueI18n from 'vue-i18n'
import { createI18n, castToVueI18n } from 'vue-i18n-bridge'
import VueObserveVisibility from 'vue-observe-visibility'
import Router from 'vue-router'
import Vuetify from 'vuetify'
import Vuex from 'vuex'
import { VuexServiceFactory } from '../../vuexServiceProxy'
import MainWindow from './App.vue'
import { createRouter } from './router'
import { useAllServices } from './services'
import { createStore } from './store'
import TextComponent from '/@/components/TextComponent'
import { ROUTER_KEY } from '/@/constant'
import { I18N_KEY, SERVICES_KEY, SERVICES_SEMAPHORES_KEY, usePreferDark, useSemaphores } from '/@/composables'
import vuetify from './vuetify'
import 'virtual:windi.css'
import { VuetifyInjectionKey } from '/@/composables/vuetify'

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
      // messages: messages,
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

const router = createRouter()

const app = new Vue(defineComponent({
  i18n,
  vuetify,
  router,
  setup(_, context) {
    // semaphore
    const semaphores = useSemaphores()
    provide(SERVICES_SEMAPHORES_KEY, semaphores)

    // i18n
    provide(I18N_KEY, i18n)

    // service & store
    const store = createStore()
    const factory = new VuexServiceFactory(store)
    useAllServices(factory)
    provide(SERVICES_KEY, factory)

    const frameowrk = vuetify.framework
    // vuetify
    provide(VuetifyInjectionKey, frameowrk)

    semaphores.refresh()

    // dynamic change locale
    store.watch((state) => state[`services/${BaseServiceKey.toString()}`].locale, (newValue: string, oldValue: string) => {
      console.log(`Locale changed ${oldValue} -> ${newValue}`)
      i18n.locale = newValue
      const lang = frameowrk.lang
      if (newValue === 'zh-CN') {
        lang.current = 'zhHans'
      } else if (newValue === 'ru') {
        lang.current = 'ru'
      } else {
        lang.current = 'en'
      }
    })

    const preferDark = usePreferDark()

    const updateTheme = (theme: 'dark' | 'system' | 'light') => {
      if (theme === 'system') {
        frameowrk.theme.dark = preferDark.value
      } else if (theme === 'dark') {
        frameowrk.theme.dark = true
      } else if (theme === 'light') {
        frameowrk.theme.dark = false
      }
    }

    updateTheme(store.state[`services/${BaseServiceKey}`].theme)

    // dynamic change theme
    store.watch((state) => state[`services/${BaseServiceKey}`].theme, (newValue: string, oldValue: string) => {
      console.log(`Theme changed ${oldValue} -> ${newValue}`)
      updateTheme(newValue as any)
    })

    // router
    const { openInBrowser } = factory.getService(BaseServiceKey)

    const wrappedRouter = new Proxy(router, {
      get(target, key) {
        const prop = Reflect.get(target, key)
        if (prop instanceof Function) {
          return (prop as Function).bind(target)
        }
        return prop
      },
    })

    router.beforeEach((to, from, next) => {
      const full = to.fullPath.substring(1)
      if (full.startsWith('https:') || full.startsWith('http:') || full.startsWith('external')) {
        next(false)
        console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`)
        if (full.startsWith('external')) {
          console.log(full.substring('external/'.length))
          openInBrowser(full.substring('external/'.length))
        } else {
          openInBrowser(full)
        }
      } else {
        console.log(`Route ${from.fullPath} -> ${to.fullPath}`)
        next()
      }
    })

    provide(ROUTER_KEY, wrappedRouter)

    // render the main window
    return () => h(MainWindow)
  },
}))

Vue.component('TextComponent', TextComponent)

app.$mount('#app')
