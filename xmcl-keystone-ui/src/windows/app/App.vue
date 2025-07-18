<template>
  <v-app
    class="h-full max-h-[100vh] overflow-hidden"
    :class="{ 'dark': isDark }"
  >
    <AppSystemBar
      no-task
      no-user
      no-debug
    />
    <div
      class="relative flex h-full overflow-auto"
    >
      <main
        class="relative inset-y-0 right-0 flex max-h-full flex-col overflow-auto"
      >
        <Multiplayer />
      </main>
    </div>
    <AppContextMenu />
    <AppSharedTooltip />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppSharedTooltip from '@/components/AppSharedTooltip.vue'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { useNotifier } from '@/composables/notifier'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import Multiplayer from '@/views/Multiplayer.vue'

const { isDark } = injection(kTheme)

const { notify } = useNotifier()
useDefaultErrorHandler(notify)
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
