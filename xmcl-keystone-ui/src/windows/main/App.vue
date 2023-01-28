<template>
  <v-app
    v-if="!shouldSetup"
    class="overflow-auto h-full overflow-x-hidden max-h-[100vh]"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <AppBackground />
    <AppSystemBar />
    <div
      class="flex h-full overflow-auto relative"
    >
      <AppSideBar />
      <main
        class="flex top-0 bottom-0 right-0 overflow-auto max-h-full relative"
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
    <AppLoginDialog />
    <AppTaskDialog />
    <AppAddInstanceDialog />
    <AppAddServerDialog />
    <AppExportDialog />
    <AppShareInstanceDialog />
    <AppInstanceDeleteDialog />
    <ImageDialog />
  </v-app>
  <v-app
    v-else
    class="overflow-auto h-full overflow-x-hidden max-h-[100vh]"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <AppSystemBar />
    <div
      class="flex h-full overflow-auto relative"
    >
      <Setup @ready="shouldSetup = false" />
    </div>
    <AppFeedbackDialog />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppContextMenu from '@/views/AppContextMenu.vue'
import { useExternalRoute, useI18nSync, useThemeSync } from '@/composables'
import { useAuthProfileImportNotification } from '@/composables/authProfileImport'
import { useBackground } from '@/composables/background'
import { kColorTheme, useColorTheme } from '@/composables/colorTheme'
import { useDropService } from '@/composables/dropService'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { kModpacks, useModpacks } from '@/composables/modpack'
import { kUILayout, useUILayout } from '@/composables/uiLayout'
import { kVuetify } from '@/composables/vuetify'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppAddServerDialog from '@/views/AppAddServerDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppDropDialog from '@/views/AppDropDialog.vue'
import AppExportDialog from '@/views/AppExportDialog.vue'
import AppFeedbackDialog from '@/views/AppFeedbackDialog.vue'
import AppInstanceDeleteDialog from '@/views/AppInstanceDeleteDialog.vue'
import AppLoginDialog from '@/views/AppLoginDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppShareInstanceDialog from '@/views/AppShareInstanceDialog.vue'
import AppSideBar from '@/views/AppSideBar.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import Setup from '@/views/Setup.vue'
import { useAllServices } from './services'
import ImageDialog from '@/components/ImageDialog.vue'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'

const colorTheme = useColorTheme()
const { primaryColor, accentColor, infoColor, errorColor, successColor, warningColor, backgroundColor } = colorTheme
const { blurMainBody } = useBackground()
provide(kColorTheme, colorTheme)

const cssVars = computed(() => ({
  '--primary': primaryColor.value,
  'background-color': backgroundColor.value,
}))

const shouldSetup = ref(location.search.indexOf('setup') !== -1)

const vuetify = injection(kVuetify)

if (primaryColor.value) { vuetify.theme.currentTheme.primary = primaryColor.value }
if (accentColor.value) { vuetify.theme.currentTheme.accent = accentColor.value }
if (infoColor.value) { vuetify.theme.currentTheme.info = infoColor.value }
if (errorColor.value) { vuetify.theme.currentTheme.error = errorColor.value }
if (successColor.value) { vuetify.theme.currentTheme.success = successColor.value }
if (warningColor.value) { vuetify.theme.currentTheme.warning = warningColor.value }

watch(primaryColor, (newColor) => { vuetify.theme.currentTheme.primary = newColor })
watch(accentColor, (newColor) => { vuetify.theme.currentTheme.accent = newColor })
watch(infoColor, (newColor) => { vuetify.theme.currentTheme.info = newColor })
watch(errorColor, (newColor) => { vuetify.theme.currentTheme.error = newColor })
watch(successColor, (newColor) => { vuetify.theme.currentTheme.success = newColor })
watch(warningColor, (newColor) => { vuetify.theme.currentTheme.warning = newColor })

useAllServices()
useDropService()
useDefaultErrorHandler()
useAuthProfileImportNotification()
useI18nSync()
useThemeSync()
useExternalRoute()
provide(kUILayout, useUILayout())
provide(kModpacks, useModpacks())
provide(kImageDialog, useImageDialog())

</script>

<style>
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
