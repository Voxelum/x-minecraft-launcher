<template>
  <v-tooltip
    v-model="isShown"
    color="black"
    transition="scroll-y-reverse-transition"
    :position-x="x"
    :position-y="y"
    top
  >
    {{ currentTooltip }}
  </v-tooltip>
</template>

<script lang="ts" setup>
import { kModTooltip } from '@/composables/modTooltip'
import { injection } from '@/util/inject'

const { currentTooltip, x, y, isShown } = injection(kModTooltip)
</script>
