<template>
  <v-app v-if="!showSetup" class="h-full max-h-screen overflow-auto overflow-x-hidden" :class="{ 'dark': isDark }">
    <AppBackground />
    <div class="w-full h-full absolute left-0 header-overlay" :style="{
      height: headerHeight + (compact ? 30 : 70) + 'px',
      'background-image': `linear-gradient(${appBarColor}, transparent)`
    }">
    </div>
    <AppSystemBar />
    <div class="relative flex h-full overflow-auto">
      <AppSideBar />
      <main class="relative inset-y-0 right-0 flex max-h-full flex-col overflow-auto">
        <transition name="fade-transition" mode="out-in">
          <router-view class="z-2" />
        </transition>
      </main>
    </div>
    <!-- <AppDropDialog /> -->
    <AppContextMenu />
    <AppNotifier />
    <AppFeedbackDialog />
    <AppTaskDialog />
    <AppAddInstanceDialog />
    <AppExportDialog />
    <AppShareInstanceDialog />
    <AppInstanceDeleteDialog />
    <AppGameExitDialog />
    <AppLaunchBlockedDialog />
    <AppImageDialog />
    <AppLaunchServerDialog />
    <AppSharedTooltip />
    <AppInstallSkipDialog />
    <AppMigrateWizardDialog />
    <AppExportServerDialog />
    <AppModrinthLoginDialog />
  </v-app>
  <v-app v-else class="h-full max-h-screen overflow-auto overflow-x-hidden" :class="{ 'dark': isDark }">
    <AppSystemBar no-user no-task />
    <div class="relative flex h-full overflow-auto">
      <Setup @ready="onReady" />
    </div>
    <AppFeedbackDialog />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppImageDialog from '@/components/AppImageDialog.vue'
import AppSharedTooltip from '@/components/AppSharedTooltip.vue'
import { useAuthProfileImportNotification } from '@/composables/authProfileImport'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { kInstance } from '@/composables/instance'
import { kLaunchButton, useLaunchButton } from '@/composables/launchButton'
import { kLocalizedContent, useLocalizedContentControl } from '@/composables/localizedContent'
import { useNotifier } from '@/composables/notifier'
import { kCompact } from '@/composables/scrollTop'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kTutorial } from '@/composables/tutorial'
import { kInFocusMode, kUILayout } from '@/composables/uiLayout'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppExportDialog from '@/views/AppExportDialog.vue'
import AppExportServerDialog from '@/views/AppExportServerDialog.vue'
import AppFeedbackDialog from '@/views/AppFeedbackDialog.vue'
import AppGameExitDialog from '@/views/AppGameExitDialog.vue'
import AppInstallSkipDialog from '@/views/AppInstallSkipDialog.vue'
import AppInstanceDeleteDialog from '@/views/AppInstanceDeleteDialog.vue'
import AppLaunchBlockedDialog from '@/views/AppLaunchBlockedDialog.vue'
import AppLaunchServerDialog from '@/views/AppLaunchServerDialog.vue'
import AppMigrateWizardDialog from '@/views/AppMigrateWizardDialog.vue'
import AppModrinthLoginDialog from '@/views/AppModrinthLoginDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppShareInstanceDialog from '@/views/AppShareInstanceDialog.vue'
import AppSideBar from '@/views/AppSideBar.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import Setup from '@/views/Setup.vue'
import { useLocalStorage, useMediaQuery } from '@vueuse/core'

const showSetup = ref(location.search.indexOf('bootstrap') !== -1)
const { state } = injection(kSettingsState)

provide('streamerMode', useLocalStorageCacheBool('streamerMode', false))
provide(kLocalizedContent, useLocalizedContentControl())

const layout = injection(kUILayout)
const modes = useLocalStorage('instanceEnabledDashboard', {} as Record<string, boolean>)
const { path } = injection(kInstance)
const isLessThan490px = useMediaQuery('(max-height: 490px)')
provide(kInFocusMode, computed({
  get() {
    const less = isLessThan490px.value
    const isDashboard = modes.value[basename(path.value)]
    if (isDashboard === undefined) {
      return layout.value === 'focus' ? true : false
    }
    if (less) {
      return false
    }
    return !isDashboard
  },
  set(inFocus) {
    const isDashboard = !inFocus
    modes.value = { ...modes.value, [basename(path.value)]: isDashboard }
  },
}))

provide(kLaunchButton, useLaunchButton())

const compact = ref(false)
provide(kCompact, compact)

const headerHeight = ref(0)
provide('headerHeight', headerHeight)

const { appBarColor } = injection(kTheme)

const tutor = injection(kTutorial)
// Set theme and start tutorial
const onReady = async (data: any) => {
  await nextTick()
  showSetup.value = false
  await nextTick()
  if (state.value) {
    state.value.themeSet(data.theme)
  } else {
    const unwatch = watch(state, (state) => {
      if (state) {
        state.themeSet(data.theme)
      }
      unwatch()
    })
  }
  tutor.start()
}

// color theme sync
const { isDark } = injection(kTheme)

// Notifier
const { notify } = useNotifier()
useDefaultErrorHandler(notify)
useAuthProfileImportNotification(notify)
</script>

<style scoped>
.clip-head {
  clip-path: inset(0px 30px 30px 0px) !important;
  width: 64px;
  height: auto;
  /*to preserve the aspect ratio of the image*/
}

.v-input__icon--prepend {
  margin-right: 7px;
}

img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
