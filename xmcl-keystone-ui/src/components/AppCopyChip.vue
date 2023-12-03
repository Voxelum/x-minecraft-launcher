<template>
  <v-chip
    v-shared-tooltip="value"
    v-ripple
    color="grey darken-4"
    class="cursor-pointer"
    :small="!large"
    @click="onInfoClicked(value)"
  >
    <span
      class="select-text overflow-hidden overflow-ellipsis"
    >
      {{ value }}
    </span>
    <v-icon
      x-small
      right
    >
      content_copy
    </v-icon>
  </v-chip>
</template>
<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  value: string
  large?: boolean
}>()

const onInfoClicked = (value: string) => {
  navigator.clipboard.writeText(value)
}
</script>
