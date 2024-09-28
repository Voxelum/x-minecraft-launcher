<template>
  <v-app
    v-if="!showSetup"
    class="h-full max-h-screen overflow-auto overflow-x-hidden"
    :class="{ 'dark': isDark }"
  >
    <AppBackground />
    <AppSystemBar />
    <div
      class="relative flex h-full overflow-auto"
    >
      <AppSideBar />
      <main
        class="relative inset-y-0 right-0 flex max-h-full flex-col overflow-auto"
      >
        <transition
          name="fade-transition"
          mode="out-in"
        >
          <router-view class="z-2" />
        </transition>
      </main>
    </div>
    <AppDropDialog />
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
  </v-app>
  <v-app
    v-else
    class="h-full max-h-screen overflow-auto overflow-x-hidden"
    :class="{ 'dark': isDark }"
  >
    <AppSystemBar
      no-user
      no-task
    />
    <div
      class="relative flex h-full overflow-auto"
    >
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
import { useNotifier } from '@/composables/notifier'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppDropDialog from '@/views/AppDropDialog.vue'
import AppExportDialog from '@/views/AppExportDialog.vue'
import AppFeedbackDialog from '@/views/AppFeedbackDialog.vue'
import AppGameExitDialog from '@/views/AppGameExitDialog.vue'
import AppInstanceDeleteDialog from '@/views/AppInstanceDeleteDialog.vue'
import AppLaunchBlockedDialog from '@/views/AppLaunchBlockedDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppLaunchServerDialog from '@/views/AppLaunchServerDialog.vue'
import AppShareInstanceDialog from '@/views/AppShareInstanceDialog.vue'
import AppSideBar from '@/views/AppSideBar.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import Setup from '@/views/Setup.vue'
import { kLaunchButton, useLaunchButton } from '@/composables/launchButton'

const showSetup = ref(location.search.indexOf('bootstrap') !== -1)
const { state } = injection(kSettingsState)

provide('streamerMode', useLocalStorageCacheBool('streamerMode', false))

provide(kLaunchButton, useLaunchButton())

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
  height: auto; /*to preserve the aspect ratio of the image*/
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
