import VueCompositionApi, { createApp, defineComponent, h, provide } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import {
  Camera, Color, LinearFilter, Mesh,
  PlaneGeometry, RGBAFormat, Scene,
  ShaderMaterial,
  TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import VueObserveVisibility from 'vue-observe-visibility'
import Router from 'vue-router'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'
import Vuex from 'vuex'
import { SERVICES_KEY, VuexServiceFactory } from '../../vuexServiceProxy'
import './directives'
import MainWindow from './index.vue'
import { createRouter } from './router'
import { useAllServices } from './services'
import { createStore } from './store'
import '/@/assets/google.font.css'
import locales from '/@/assets/locales'
import CurseforgeIcon from '/@/components/CurseforgeIcon.vue'
import FabricIcon from '/@/components/FabricIcon.vue'
import ForgeIcon from '/@/components/ForgeIcon.vue'
import JarFileIcon from '/@/components/JarFileIcon.vue'
import ModrinthIcon from '/@/components/ModrinthIcon.vue'
import PackageFileIcon from '/@/components/PackageFileIcon.vue'
import TextComponent from '/@/components/TextComponent'
import ZipFileIcon from '/@/components/ZipFileIcon.vue'
import { I18N_KEY, ROUTER_KEY } from '/@/constant'
import { SERVICES_SEMAPHORES_KEY, useSemaphores } from '/@/hooks'
import { createI18n } from '/@/i18n'
import 'virtual:windi.css'

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

Vue.use(VueCompositionApi)
// to prevent the universal drop activated on self element dragging
document.addEventListener('dragstart', (e) => {
  if (e.dataTransfer?.effectAllowed === 'uninitialized') {
    e.dataTransfer!.effectAllowed = 'none'
  }
})

Vue.use(VueI18n)
Vue.use(Router)

const i18n = createI18n('en', locales)
const router = createRouter()

const props: Record<string, any> = {
  i18n,
  router,
}

const app = createApp(defineComponent({
  i18n,
  router,
  setup() {
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

    // make syncable
    // const syncable = useSyncable(store)
    // provide(SYNCABLE_KEY, syncable)

    // syncable.sync()
    semaphores.refresh()

    // dynamic change locale
    store.watch((state) => state[`services/${BaseServiceKey.toString()}`].locale, (newValue: string, oldValue: string) => {
      console.log(`Locale changed ${oldValue} -> ${newValue}`)
      i18n.locale = newValue
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
}), props)

app.config.productionTip = false
app.use(Vuex)
app.use(Vuetify, {
  icons: {
    curseforge: {
      component: CurseforgeIcon,
    },
    zip: {
      component: ZipFileIcon,
    },
    jar: {
      component: JarFileIcon,
    },
    package: {
      component: PackageFileIcon,
    },
    modrinth: {
      component: ModrinthIcon,
    },
    forge: {
      component: ForgeIcon,
    },
    fabric: {
      component: FabricIcon,
    },
  },
  theme: {
    primary: colors.green,
    // secondary: colors.lime,
    accent: colors.green.accent3,
  },
})
app.use(VueObserveVisibility)
app.component('TextComponent', TextComponent)

app.mount('#app')
