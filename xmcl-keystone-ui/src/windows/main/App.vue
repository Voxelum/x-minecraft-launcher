<template>
  <v-app v-if="!showSetup" class="h-full max-h-screen overflow-auto overflow-x-hidden" :class="{ 'dark': isDark }">
    <AppBackground />
    <div class="w-full h-full absolute left-0 header-overlay" :style="{
      height: headerHeight + (compact ? 30 : 70) + 'px',
      'background-image': `linear-gradient(${appBarColor}, transparent)`
    }">
    </div>
    <AppSystemBar />
    <div 
      class="relative flex h-full overflow-auto" 
      :class="layoutClasses"
    >
      <AppSideBarClassic v-if="sidebarStyle === 'classic'" />
      <AppSideBarNotch v-else />
      <main class="relative flex max-h-full flex-1 flex-col overflow-auto" :class="mainClasses">
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
    <InstanceLauncherPage />
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
import { kInFocusMode, kUIDefaultLayout } from '@/composables/uiLayout'
import { kSidebarSettings, useSidebarSettings } from '@/composables/sidebarSettings'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
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
import AppSideBarClassic from '@/views/AppSideBarClassic.vue'
import AppSideBarNotch from '@/views/AppSideBarNotch.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import InstanceLauncherPage from '@/views/InstanceLauncherPage.vue'
import Setup from '@/views/Setup.vue'
import { useLocalStorage, useMediaQuery } from '@vueuse/core'
import { kInstanceLauncher, useInstanceLauncher } from '@/composables/instanceLauncher'

const showSetup = ref(location.search.indexOf('bootstrap') !== -1)
const { state } = injection(kSettingsState)

provide('streamerMode', useLocalStorageCacheBool('streamerMode', false))
provide(kLocalizedContent, useLocalizedContentControl())
provide(kInstanceLauncher, useInstanceLauncher())

const layout = injection(kUIDefaultLayout)
const modes = useLocalStorage('instanceEnabledDashboard', {} as Record<string, boolean>)
const { path } = injection(kInstance)
const isLessThan490px = useMediaQuery('(max-height: 570px)')
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

const sidebarSettings = useSidebarSettings()
provide(kSidebarSettings, sidebarSettings)
const sidebarPosition = computed(() => sidebarSettings.position.value)
const sidebarStyle = computed(() => sidebarSettings.style.value)

const layoutClasses = computed(() => ({
  'flex-row': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'flex-col': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
  'flex-row-reverse': sidebarPosition.value === 'right',
  'flex-col-reverse': sidebarPosition.value === 'bottom',
}))

const mainClasses = computed(() => ({
  'inset-y-0': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'inset-x-0': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
}))

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
