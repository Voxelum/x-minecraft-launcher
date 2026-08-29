import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { createApp, h, provide, ref } from 'vue'
import { useUserContext, kUserContext } from '@/composables/user'
import { kCompact } from '@/composables/scrollTop'
import BrowseVue from './Browse.vue'
import { BaseServiceKey } from '@xmcl/runtime-api'

const app = createApp({
  setup() {
    const userContext = useUserContext()
    const compact = ref(false)

    provide(kUserContext, userContext)
    provide(kCompact, compact)

    const baseServiceChannel = serviceChannels.open(BaseServiceKey)
    baseServiceChannel.call('getSettings').then(state => state).then(state => {
      ;(i18n.global.locale as any).value = state.locale
      state.subscribe('localeSet', (locale) => {
        ;(i18n.global.locale as any).value = locale
      })
    })
    return () => h(BrowseVue)
  },
})

app.use(i18n)
app.use(vuetify)

app.mount('#app')

