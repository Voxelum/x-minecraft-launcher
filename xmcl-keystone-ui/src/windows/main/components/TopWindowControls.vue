<template>
  <span class="p-0 flex flex-shrink flex-grow-0">
    <v-icon
      v-ripple
      class="flex items-center px-2 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)]"
      dark
      small
      @click="showFeedbackDialog"
    >
      help_outline
    </v-icon>
    <v-icon
      v-ripple
      class="flex items-center px-2 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)]"
      dark
      small
      @click="minimize"
    >minimize</v-icon>
    <v-icon
      v-ripple
      class="flex items-center px-2 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)]"
      dark
      small
      @click="maximize"
    >maximize</v-icon>

    <v-icon
      v-ripple
      class="flex items-center px-2 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgb(209,12,12)]"
      dark
      small
      @click="close"
    >close</v-icon>
  </span>
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables'
import { useService, useWindowController } from '/@/hooks'

export default defineComponent({
  setup() {
    const { maximize, minimize, hide } = useWindowController()
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
