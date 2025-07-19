<template>
  <v-chip
    v-shared-tooltip="value"
    :label="label"
    color="dark:(grey darken-4)"
    class="cursor-pointer"
    :size="!large ? 'small' : undefined"
    :outlined="outlined"
    :variant="outlined ? 'outlined' : 'text'"
    @click="onInfoClicked(value)"
  >
    <span
      class="select-text overflow-hidden overflow-ellipsis"
    >
      {{ value }}
    </span>
    <v-icon
      size="small"
      end
      :color="clicked ? 'green' : ''"
    >
      {{ clicked ? 'check' : 'content_copy' }}
    </v-icon>
  </v-chip>
</template>
<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  value: string
  large?: boolean
  label?: boolean
  outlined?: boolean
}>()

const clicked = ref(false)

const onInfoClicked = (value: string) => {
  windowController.writeClipboard(value)
  clicked.value = true
}
</script>
