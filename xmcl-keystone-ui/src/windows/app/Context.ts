import { useI18nSync } from '@/composables'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstances, useInstances } from '@/composables/instances'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kPeerState, usePeerState } from '@/composables/peers'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kTheme, useTheme } from '@/composables/theme'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kUserContext, useUserContext } from '@/composables/user'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())

    provide(kTheme, useTheme(vuetify.framework))

    const settings = useSettingsState()
    provide(kSettingsState, settings)

    useI18nSync(vuetify.framework, settings.state)

    const userContext = useUserContext()
    provide(kUserContext, userContext)
    provide(kPeerState, usePeerState(userContext.gameProfile))

    provide(kLocalVersions, useLocalVersions())
    const instances = useInstances()
    provide(kInstances, instances)
    provide(kInstance, useInstance(instances.selectedInstance, instances.instances))

    provide(kUILayout, useUILayout())
    provide(kImageDialog, useImageDialog())

    return () => ctx.slots.default?.()
  },
})
