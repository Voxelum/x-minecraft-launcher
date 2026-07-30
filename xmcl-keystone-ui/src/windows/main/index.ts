/* eslint-disable vue/one-component-per-file */
import TextComponent from '@/components/TextComponent'
import { kServiceFactory, useServiceFactory } from '@/composables'
import { kDialogModel, useDialogModel } from '@/composables/dialog'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'
import { kTaskManager, useTaskManager } from '@/composables/taskManager'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { createApp, defineComponent, h, provide } from 'vue'
import App from './App.vue'
import Context from './Context'
import { router } from './router'
import { kFlights } from '@/composables/flights'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { appInsights, isIgnorableRendererExceptionMessage } from '@/telemetry'

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

  // The currently selected instance is stored as a plain absolute path.
  const selectedInstancePath = localStorage.getItem('selectedInstancePath')
  if (selectedInstancePath) {
    localStorage.setItem('selectedInstancePath', selectedInstancePath.split(from).join(to))
  }

  // Java bypass whitelist: { <instancePath>: <javaPath> }. Both the key and the
  // value (for a managed JRE under the root) may reference the old root.
  const instanceJavaBypass = localStorage.getItem('instanceJavaBypass')
  if (instanceJavaBypass) {
    try {
      const value = JSON.parse(instanceJavaBypass) as Record<string, string>
      const transformed = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k.split(from).join(to),
          typeof v === 'string' ? v.split(from).join(to) : v,
        ]),
      )
      localStorage.setItem('instanceJavaBypass', JSON.stringify(transformed))
    } catch {
      // ignore malformed cache
    }
  }

  // Per-instance settings whose localStorage KEY embeds the absolute instance
  // path. Rename the keys so the settings stay attached to their instance after
  // the data root moves. (These keys hold raw, unescaped paths.)
  const pathKeyedPrefixes = [
    'instanceDefaultSource?instance=',
    'instanceUpstreamOnlyShowCurrentVersion/',
    'modsUpgradeSkipVersion:',
    'modsUpgradePolicy:',
    'modGroupsCollapsed:',
  ]
  for (const key of Object.keys(localStorage)) {
    if (!pathKeyedPrefixes.some((prefix) => key.startsWith(prefix))) continue
    const newKey = key.split(from).join(to)
    if (newKey === key) continue
    const value = localStorage.getItem(key)
    if (value !== null) {
      localStorage.setItem(newKey, value)
      localStorage.removeItem(key)
    }
  }
}

const app = createApp(defineComponent({
  setup() {
    document.body.classList.remove('unloaded')
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

    return () => h(Context, null, { default: () => h(App) })
  },
}))

app.use(i18n)
app.use(vuetify)
app.use(router)

app.component('TextComponent', TextComponent as any)

app.config.warnHandler = (msg, vm, trace) => {
  const level = msg.indexOf('TypeError') !== -1 ? 4 : 3
  console.warn(msg)

  if (level === 4) {
    appInsights.flush(false, () => {
      window.location.reload()
    })
  }
}

app.config.errorHandler = (err: any, vm, info) => {
  if (err?.message?.indexOf('ResizeObserver') !== -1) {
    // ignore ResizeObserver error
    return
  }
  if (typeof err?.message === 'string' && isIgnorableRendererExceptionMessage(err.message)) {
    return
  }

  const level = err?.message?.indexOf('TypeError') !== -1 ? 4 : 3
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

app.mount('#app')
