
import TextComponent from '@/components/TextComponent'
import { kServiceFactory, useServiceFactory } from '@/composables'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kFlights } from '@/composables/flights'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'
import { kTaskManager, useTaskManager } from '@/composables/taskManager'
import { i18n } from '@/i18n'
import { appInsights } from '@/telemetry'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { defineComponent, h, provide } from 'vue'
import App from './App.vue'
import Context from './Context'
import { router } from './router'

// to prevent the universal drop activated on self element dragging
document.addEventListener('dragstart', (e) => {
  if (e.dataTransfer?.effectAllowed === 'uninitialized') {
    e.dataTransfer!.effectAllowed = 'none'
  }
})

function handleMigrate(from: string, to: string) {
  const modsGrouping = localStorage.getItem('modsGrouping')
  if (modsGrouping) {
    const value = JSON.parse(modsGrouping)
    const transformed = Object.fromEntries(Object.entries(value).map(([key, value]) => {
      return [
        key.replace(from, to),
        value
      ]
    }))
    localStorage.setItem('modsGrouping', JSON.stringify(transformed))
  }

  const instanceGroup = localStorage.getItem('instanceGroup')
  if (instanceGroup) {
    const value = JSON.parse(instanceGroup) as (string | { instances: string[] })[]
    const transformed = value.map((value) => {
      return typeof value === 'string' ? value.replace(from, to) : {
        ...value,
        instances: value.instances.map((instance) => instance.replace(from, to))
      }
    })
    localStorage.setItem('instanceGroup', JSON.stringify(transformed))
  }

  const remoteSSHServers = localStorage.getItem('remoteSSHServers')
  if (remoteSSHServers) {
    const value = JSON.parse(remoteSSHServers)
    const transformed = Object.fromEntries(Object.entries(value).map(([key, value]) => {
      return [
        key.replace(from, to),
        value
      ]
    }))
    localStorage.setItem('remoteSSHServers', JSON.stringify(transformed))
  }
}

const app = createApp(defineComponent({
  setup() {
    // get from to from the query
    const query = new URLSearchParams(window.location.search)
    const from = query.get('from')
    const to = query.get('to')
    if (from && to) {
      handleMigrate(from, to)
    }
    provide(kFlights, (window as any).flights || {})
    provide(kNotificationQueue, useNotificationQueue())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kTaskManager, useTaskManager())
    provide(kServiceFactory, useServiceFactory())
    provide(kDialogModel, useDialogModel())
    provide(kSWRVConfig, useSWRVConfig())

    return () => h(Context, () => [h(App)])
  },
}))

app.component('TextComponent', TextComponent)
app.use(vuetify)
app.use(i18n)
app.use(router)
app.mount('#app')

app.config.warnHandler = (msg, vm, trace) => {
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

app.config.errorHandler = (err: any, vm, info) => {
  if (err.message.indexOf('ResizeObserver') !== -1) {
    // ignore ResizeObserver error
    return
  }

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
