import TextComponent from '@/components/TextComponent'
import { kServiceFactory, useServiceFactory } from '@/composables'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'
import { kTaskManager, useTaskManager } from '@/composables/taskManager'
import { kVuetify } from '@/composables/vuetify'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:windi.css'
import Vue, { defineComponent, getCurrentInstance, h, provide } from 'vue'
import App from './App.vue'
import Context from './Context'
import { router } from './router'

// to prevent the universal drop activated on self element dragging
document.addEventListener('dragstart', (e) => {
  if (e.dataTransfer?.effectAllowed === 'uninitialized') {
    e.dataTransfer!.effectAllowed = 'none'
  }
})

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

    provide(kVuetify, vuetify.framework)
    provide(kTaskManager, useTaskManager())
    provide(kServiceFactory, useServiceFactory())
    provide(kDialogModel, useDialogModel())
    provide(kSWRVConfig, useSWRVConfig())

    return () => h(Context, [h(App)])
  },
}))

Vue.component('TextComponent', TextComponent)

app.$mount('#app')

const params = window.location.search.substring(1)
if (params.startsWith('route=')) {
  const route = decodeURIComponent(params.substring('route='.length))
  const split = route.split('/')
  if (split.length > 2) {
    const base = split.slice(0, split.length - 1).join('/')
    if (base.endsWith('curseforge')) {
      router.replace(route)
      console.log(`Replace to ${route}`)
    } else {
      router.replace(base)
      console.log(`Replace to ${base}`)
      router.push(route)
      console.log(`Push to ${route}`)
    }
  } else {
    router.replace(route)
    console.log(`Replace to ${route}`)
  }
}

router.afterEach((to, from) => {
  console.log(`Route changed from ${from.path} to ${to.path}`)
})

window.addEventListener('message', (e) => {
  if (e.data.route) {
    if (router.currentRoute.path !== e.data.route) {
      router.push(e.data.route)
    }
    windowController.focus()
  }
})
