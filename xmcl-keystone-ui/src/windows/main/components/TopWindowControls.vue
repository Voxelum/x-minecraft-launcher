<template>
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
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables'
import { useService } from '/@/hooks'

export default defineComponent({
  setup() {
    const { maximize, minimize, hide } = windowController
    const { quit } = useService(BaseServiceKey)
    const { show: showFeedbackDialog } = useDialog('feedback')

    function close() {
      // hide()
      quit()
    }
    return {
      maximize,
      minimize,
      close,
      showFeedbackDialog,
    }
  },
})
</script>
