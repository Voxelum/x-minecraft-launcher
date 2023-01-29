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
import { kSharedTooltip } from '@/composables/sharedTooltip'
import { injection } from '@/util/inject'

const { currentTooltip, x, y, isShown, color } = injection(kSharedTooltip)
</script>
