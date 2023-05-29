import { kSemaphores, useExternalRoute, useI18nSync, useSemaphores, useThemeSync } from '@/composables'
import { kColorTheme, useColorTheme } from '@/composables/colorTheme'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstances, useInstances } from '@/composables/instances'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kMarketRoute, useMarketRoute } from '@/composables/useMarketRoute'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { kVuetify } from '@/composables/vuetify'
import { vuetify } from '@/vuetify'
import 'virtual:windi.css'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kVuetify, vuetify.framework)
    provide(kSemaphores, useSemaphores())
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())

    provide(kColorTheme, useColorTheme(computed(() => vuetify.framework.theme.dark)))

    const settings = useSettingsState()
    provide(kSettingsState, settings)

    useI18nSync(vuetify.framework, settings.state)
    useThemeSync(vuetify.framework, settings.state)

    const router = useRouter()
    useExternalRoute(router)

    provide(kLocalVersions, useLocalVersions())
    const instances = useInstances()
    provide(kInstances, instances)
    provide(kInstance, useInstance(instances.selectedInstance, instances.instances))

    provide(kUILayout, useUILayout())
    provide(kImageDialog, useImageDialog())
    provide(kMarketRoute, useMarketRoute())

    return () => ctx.slots.default?.()
  },
})
