/* eslint-disable vue/one-component-per-file */
import TextComponent from '@/components/TextComponent'
import { kServiceFactory, useServiceFactory } from '@/composables'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'
import { kTaskManager, useTaskManager } from '@/composables/taskManager'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import Vue, { defineComponent, getCurrentInstance, h, provide } from 'vue'
import App from './App.vue'
import Context from './Context'
import { router } from './router'
import { kFlights } from '@/composables/flights'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { appInsights } from '@/telemetry'

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

    provide(kFlights, (window as any).flights || {})
    provide(kNotificationQueue, useNotificationQueue())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kTaskManager, useTaskManager())
    provide(kServiceFactory, useServiceFactory())
    provide(kDialogModel, useDialogModel())
    provide(kSWRVConfig, useSWRVConfig())

    return () => h(Context, [h(App)])
  },
}))

Vue.component('TextComponent', TextComponent)

app.$mount('#app')

Vue.config.warnHandler = (msg, vm, trace) => {
  const level = msg.indexOf('TypeError') !== -1 ? 4 : 3
  appInsights.trackException({
    exception: {
      name: 'VueWarn',
      message: msg,
      stack: trace,
    },
    severityLevel: level,
  })
  console.warn(msg)

  if (level === 4) {
    appInsights.flush(false, () => {
      window.location.reload()
    })
  }
}

Vue.config.errorHandler = (err, vm, info) => {
  const level = err.message.indexOf('TypeError') !== -1 ? 4 : 3
  appInsights.trackException({
    exception: err,
    severityLevel: level,
  })
  console.error(err)

  if (level === 4) {
    appInsights.flush(false, () => {
      window.location.reload()
    })
  }
}
