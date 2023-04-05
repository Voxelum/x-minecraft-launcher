<template>
  <v-app
    class="overflow-auto h-full overflow-x-hidden max-h-[100vh]"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <AppSystemBar
      no-task
      no-user
      back
    >
      <span
        v-if="router.currentRoute.path.startsWith('/modrinth')"
        class="flex items-center"
      >
        <v-icon small>
          $vuetify.icons.modrinth
        </v-icon>
        Modrinth
      </span>
      <span
        v-else-if="router.currentRoute.path.startsWith('/curseforge')"
        class="flex items-center"
      >
        <v-icon small>
          $vuetify.icons.curseforge
        </v-icon>
        CurseForge
      </span>
      <span
        v-else
        class="flex items-center"
      >
        <v-icon small>
          $vuetify.icons.ftb
        </v-icon>
        FeedTheBeast
      </span>
    </AppSystemBar>
    <div
      class="flex h-full overflow-auto relative"
    >
      <main
        class="flex flex-col top-0 bottom-0 right-0 overflow-auto max-h-full relative"
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
    <AppContextMenu />
    <AppNotifier />
    <AppTaskDialog />
    <ImageDialog />
    <SharedTooltip />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import ImageDialog from '@/components/ImageDialog.vue'
import SharedTooltip from '@/components/SharedTooltip.vue'
import { useExternalRoute, useI18nSync, useThemeSync } from '@/composables'
import { useBackground } from '@/composables/background'
import { kColorTheme, useColorTheme } from '@/composables/colorTheme'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { kVuetify } from '@/composables/vuetify'
import { injection } from '@/util/inject'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppTaskDialog from '@/views/AppTaskDialog.vue'
import { useAllServices } from './services'
import { kSWRVConfig, useSWRVConfig } from '@/composables/swrvConfig'

const colorTheme = useColorTheme()
const { primaryColor, accentColor, infoColor, errorColor, successColor, warningColor, backgroundColor } = colorTheme
const { blurMainBody } = useBackground()
provide(kColorTheme, colorTheme)

const cssVars = computed(() => ({
  '--primary': primaryColor.value,
  'background-color': backgroundColor.value,
}))

const vuetify = injection(kVuetify)

useAllServices()
useDefaultErrorHandler()
useI18nSync()
useThemeSync()
useExternalRoute()
provide(kImageDialog, useImageDialog())
const router = useRouter()
provide(kSWRVConfig, useSWRVConfig())

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

/* main {
  border-left: 1px solid hsla(0,0%,100%,.12);
  border-top: 1px solid hsla(0,0%,100%,.12);
  border-top-left-radius: 0.5rem;
} */
</style>
