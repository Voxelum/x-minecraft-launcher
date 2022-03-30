<template>
  <v-system-bar
    topbar
    window
    class="flex w-full moveable p-0 flex-grow-0"
  >
    <span class="p-0 flex flex-shrink flex-grow-0">
      <v-icon
        v-ripple
        small
        class="flex items-center py-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer select-none non-moveable after:hidden"
        style="width: 80px;"
        @click="goBack"
      >
        arrow_back
      </v-icon>
    </span>
    <div class="flex-grow " />
    <span class="p-0 flex flex-shrink flex-grow-0 h-full">
      <v-icon
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"

        small
        @click="showFeedbackDialog"
      >
        help_outline
      </v-icon>
      <v-icon
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"

        small
        @click="minimize"
      >minimize</v-icon>
      <v-icon
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"
        small
        @click="maximize"
      >maximize</v-icon>
      <v-icon
        v-ripple
        class="flex items-center px-3 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgb(209,12,12)] after:hidden mr-0"

        small
        @click="close"
      >close</v-icon>
    </span>
  </v-system-bar>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useRouter, useService } from '/@/composables'

const { maximize, minimize, hide } = windowController
const { quit } = useService(BaseServiceKey)
const { show: showFeedbackDialog } = useDialog('feedback')
const router = useRouter()

function close() {
  quit()
}
function goBack() {
  router.back()
}

</script>
