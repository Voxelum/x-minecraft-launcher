<template>
  <v-app
    v-if="!shouldSetup"
    class="h-full max-h-[100vh] overflow-auto overflow-x-hidden"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <AppBackground />
    <AppSystemBar />
    <div
      class="relative flex h-full overflow-auto"
    >
      <AppSideBar />
      <main
        class="relative inset-y-0 right-0 flex max-h-full flex-col overflow-auto"
        :class="{ solid: !blurMainBody }"
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
    <AppAddServerDialog />
    <AppExportDialog />
    <AppShareInstanceDialog />
    <AppInstanceDeleteDialog />
    <AppGameExitDialog />
    <AppLaunchBlockedDialog />
    <AppImageDialog />
    <AppSharedTooltip />
  </v-app>
  <v-app
    v-else
    class="h-full max-h-[100vh] overflow-auto overflow-x-hidden"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <AppSystemBar
      no-user
      no-task
    />
    <div
      class="relative flex h-full overflow-auto"
    >
      <Setup @ready="shouldSetup = false" />
    </div>
    <AppFeedbackDialog />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppImageDialog from '@/components/AppImageDialog.vue'
import AppSharedTooltip from '@/components/AppSharedTooltip.vue'
import { useAuthProfileImportNotification } from '@/composables/authProfileImport'
import { kBackground } from '@/composables/background'
import { kColorTheme } from '@/composables/colorTheme'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { useNotifier } from '@/composables/notifier'
import { kVuetify } from '@/composables/vuetify'
import { useVuetifyColorTheme } from '@/composables/vuetifyColorTheme'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppAddServerDialog from '@/views/AppAddServerDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppDropDialog from '@/views/AppDropDialog.vue'
import AppExportDialog from '@/views/AppExportDialog.vue'
import AppFeedbackDialog from '@/views/AppFeedbackDialog.vue'
import AppGameExitDialog from '@/views/AppGameExitDialog.vue'
import AppInstanceDeleteDialog from '@/views/AppInstanceDeleteDialog.vue'
import AppLaunchBlockedDialog from '@/views/AppLaunchBlockedDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppShareInstanceDialog from '@/views/AppShareInstanceDialog.vue'
import AppSideBar from '@/views/AppSideBar.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import Setup from '@/views/Setup.vue'

const shouldSetup = ref(location.search.indexOf('setup') !== -1)

const { cssVars, ...colorTheme } = injection(kColorTheme)

// background
const { blurMainBody } = injection(kBackground)

// color theme sync
const vuetify = injection(kVuetify)
useVuetifyColorTheme(vuetify, colorTheme)

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
