import { useI18nSync } from '@/composables'
import { kCustomCss, useCustomCss } from '@/composables/customCss'
import { kEnvironment, useEnvironment } from '@/composables/environment'
import { kExceptionHandlers, useExceptionHandlers } from '@/composables/exception'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kInstance, useInstance } from '@/composables/instance'
import { kInstances, useInstances } from '@/composables/instances'
import { kNotificationQueue, useNotificationQueue } from '@/composables/notifier'
import { kPeerState, usePeerState } from '@/composables/peers'
import { kServerStatusCache, useServerStatusCache } from '@/composables/serverStatus'
import { kSettingsState, useSettingsState } from '@/composables/setting'
import { kSurfaceTokens, useSurfaceTokens } from '@/composables/surfaceTokens'
import { kTheme, useTheme } from '@/composables/theme'

import { kUserContext, useUserContext } from '@/composables/user'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { vuetify } from '@/vuetify'
import { provide } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())

    const theme = useTheme(ref(undefined))
    provide(kTheme, theme)
    provide(kSurfaceTokens, useSurfaceTokens())

    const settings = useSettingsState()
    provide(kSettingsState, settings)

    useI18nSync(settings.state)

    const userContext = useUserContext()
    provide(kUserContext, userContext)
    provide(kPeerState, usePeerState(userContext.gameProfile))

    provide(kLocalVersions, useLocalVersions())
    const instances = useInstances()
    provide(kInstances, instances)
    provide(kInstance, useInstance(instances.selectedInstance, instances.instances))

    provide(kImageDialog, useImageDialog())
    provide(kEnvironment, useEnvironment())
    // The app window has no instance theme, so only the global theme's custom
    // CSS applies here.
    provide(kCustomCss, useCustomCss({
      currentTheme: theme.currentTheme,
      instanceTheme: ref(undefined),
      instanceCss: ref(''),
      suppressed: theme.suppressed,
    }))

    return () => ctx.slots.default?.()
  },
})
