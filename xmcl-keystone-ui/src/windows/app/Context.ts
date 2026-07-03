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
import {
  DEFAULT_CARD_CLICKABLE_RADIUS,
  DEFAULT_CARD_ITEM_RADIUS,
  DEFAULT_CARD_PROMINENT_RADIUS,
  DEFAULT_CARD_RADIUS,
  DEFAULT_CARD_SUBSECTION_RADIUS,
  DEFAULT_PANEL_RADIUS,
  DEFAULT_SURFACE_MENU_ITEM_RADIUS,
  DEFAULT_SURFACE_PILL_RADIUS,
  DEFAULT_SURFACE_RADIUS,
  DEFAULT_SURFACE_BUTTON_RADIUS,
  DEFAULT_SURFACE_DIALOG_RADIUS,
  DEFAULT_SURFACE_TOOLTIP_RADIUS,
  kSurfaceTokens,
  useSurfaceTokens,
} from '@/composables/surfaceTokens'
import { kTheme, useTheme } from '@/composables/theme'

import { kUserContext, useUserContext } from '@/composables/user'
import { kMinecraftFriends, useMinecraftFriendsImpl } from '@/composables/minecraftFriends'
import { kLocalVersions, useLocalVersions } from '@/composables/versionLocal'
import { vuetify } from '@/vuetify'
import { provide, watchEffect } from 'vue'

export default defineComponent({
  setup(props, ctx) {
    provide(kExceptionHandlers, useExceptionHandlers())
    provide(kServerStatusCache, useServerStatusCache())
    provide(kNotificationQueue, useNotificationQueue())

    const theme = useTheme(ref(undefined))
    provide(kTheme, theme)
    const surfaceTokens = useSurfaceTokens()
    provide(kSurfaceTokens, surfaceTokens)

    watchEffect(() => {
      const enabled = theme.currentTheme.value.borderRadiusEnabled ?? true
      surfaceTokens.radius.value = enabled ? DEFAULT_SURFACE_RADIUS : 0
      surfaceTokens.dialogRadius.value = enabled ? DEFAULT_SURFACE_DIALOG_RADIUS : 0
      surfaceTokens.menuItemRadius.value = enabled ? DEFAULT_SURFACE_MENU_ITEM_RADIUS : 0
      surfaceTokens.cardRadius.value = enabled ? DEFAULT_CARD_RADIUS : 0
      surfaceTokens.cardSubsectionRadius.value = enabled ? DEFAULT_CARD_SUBSECTION_RADIUS : 0
      surfaceTokens.cardItemRadius.value = enabled ? DEFAULT_CARD_ITEM_RADIUS : 0
      surfaceTokens.panelRadius.value = enabled ? DEFAULT_PANEL_RADIUS : 0
      surfaceTokens.cardProminentRadius.value = enabled ? DEFAULT_CARD_PROMINENT_RADIUS : 0
      surfaceTokens.cardClickableRadius.value = enabled ? DEFAULT_CARD_CLICKABLE_RADIUS : 0
      surfaceTokens.tooltipRadius.value = enabled ? DEFAULT_SURFACE_TOOLTIP_RADIUS : 0
      surfaceTokens.pillRadius.value = enabled ? DEFAULT_SURFACE_PILL_RADIUS : 0
      vuetify.defaults.value = {
        ...vuetify.defaults.value,
        VBtn: {
          ...vuetify.defaults.value?.VBtn,
          rounded: enabled ? DEFAULT_SURFACE_BUTTON_RADIUS : 0,
        },
        VChip: {
          ...vuetify.defaults.value?.VChip,
          rounded: enabled ? DEFAULT_SURFACE_BUTTON_RADIUS : 0,
        },
        VTextField: {
          ...vuetify.defaults.value?.VTextField,
          rounded: enabled ? undefined : 0,
        },
        VSwitch: {
          ...vuetify.defaults.value?.VSwitch,
          rounded: enabled ? undefined : 0,
        }
      }
    })

    const settings = useSettingsState()
    provide(kSettingsState, settings)

    useI18nSync(settings.state)

    const userContext = useUserContext()
    provide(kUserContext, userContext)
    provide(kPeerState, usePeerState(userContext.gameProfile))
    provide(kMinecraftFriends, useMinecraftFriendsImpl(userContext))

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
