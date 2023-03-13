<template>
  <v-tooltip
    v-model="isShown"
    :color="color"
    transition="scroll-y-reverse-transition"
    :position-x="x"
    :position-y="y"
    class="z-100"
    top
  >
    {{ currentTooltip }}
  </v-tooltip>
</template>

<script lang="ts" setup>
import { useSharedTooltipData } from '@/composables/sharedTooltip'

const { currentTooltip, x, y, isShown, color } = useSharedTooltipData()
</script>
